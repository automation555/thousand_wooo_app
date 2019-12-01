const Post = require('../models/Post.js'); 
const _ = require("fxjs/Strict");  
const config = require('../config') 
const {wrapE} = require('../util');  
const mongoose = require('mongoose')
const Joi = require('@hapi/joi');
const sanitizeHtml = require('sanitize-html') 
const schema = Joi.object({
    title: Joi.string().required(),
    body: Joi.string().required(),
    tags: Joi.array() 
})       
const { ObjectId } = mongoose.Types;
const sanitizeOption = {
    allowedTags: [
      'h1',
      'h2',
      'b',
      'i',
      'u',
      's',
      'p',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'img',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['src'],
      li: ['class'],
    },
    allowedSchemes: ['data', 'http'],
  };

  exports.getPostById = wrapE(async(req, res, next) => {
    const id = req.params.id
    if (!ObjectId.isValid(id)) {
        throw new Error("id가 이상합니다.");  
    }
    const post = await Post.findById(id);
    if(!post){
        throw new Error("해당 포스트가 존재하지 않습니다.");   
    }
    req.post = post; 
    return next();  
})

exports.isOwn = wrapE(async(req, res, next) => {
    const user = req.user; 
    const post = req.post;  
    if (post.user._id.toString() !== user._id) {
        throw new Error("내것이 아닙니다.");   
    }
    return next(); 
})

exports.write = wrapE(async(req, res, next) => { 
    const { title, body, tags } = req.body 
    await schema.validateAsync({title, body, tags})    
    console.log(req.user)
    const post = new Post({
        title,
        body: sanitizeHtml(body, sanitizeOption),
        tags,
        user: req.user,
    });
    await post.save();
    return res.status(200).send(post);   
})
const removeHtmlAndShorten = body => {
    const filtered = sanitizeHtml(body, {
      allowedTags: [],
    });
    return filtered.length < 200 ? filtered : `${filtered.slice(0, 200)}...`;
  };

exports.showList = wrapE(async(req, res, next) => {
    // query 는 문자열이기 때문에 숫자로 변환해주어야합니다.
  // 값이 주어지지 않았다면 1 을 기본으로 사용합니다.
  const page = parseInt(req.query.page || '1', 10);

  if (page < 1) {
    throw new Error("이것은 잘못된 운명");     
  }

  const { tag, username } = req.query;
  // tag, username 값이 유효하면 객체 안에 넣고, 그렇지 않으면 넣지 않음
  const query = {
    ...(username ? { 'user.username': username } : {}),
    ...(tag ? { tags: tag } : {}),
  }; 
  const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(10)
      .skip((page - 1) * 10)
      .lean() 
      .exec()
  const postCount = await Post.countDocuments(query).exec(); 
  const ret = posts.map(post => ({...post, body : removeHtmlAndShorten(post.body)}))
  res.set('Last-Page', Math.ceil(postCount / 10));
  return res.status(200).send(ret); 
   
}) 
exports.read = wrapE(async(req, res, next) => {
    return res.status(200).send(req.post);  
})  

exports.remove = wrapE(async(req, res, next) => {
    const id = req.params.id; 
    await Post.findByIdAndRemove(id).exec();
    return res.status(204).send();  
})  

exports.update = wrapE(async(req, res, next) => {
    const id = req.params.id;  
    const {title, body, tags} = req.body; 
    await schema.validateAsync({title, body, tags})  

    const nextData = { ...req.body }; // 객체를 복사하고
    // body 값이 주어졌으면 HTML 필터링
    if (nextData.body) {
        nextData.body = sanitizeHtml(nextData.body);
    }
    const post = await Post.findByIdAndUpdate(id, nextData, {
        new: true, // 이 값을 설정하면 업데이트된 데이터를 반환합니다.
        // false 일 때에는 업데이트 되기 전의 데이터를 반환합니다.
    }).exec(); 
    return res.status(200).send(post); 
}) 