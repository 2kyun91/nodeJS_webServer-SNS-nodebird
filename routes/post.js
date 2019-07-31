const express = require('express');
const multer = require('multer'); // multipart(이미지 등) 처리용 모듈이다.
const path = require('path');
const fs = require('fs');

const {Post, Hashtag, User} = require('../models');
const {isLoggedIn} = require('./middlewares');

const router = express.Router();
fs.readdir('uploads', (error) => {
    if (error) {
        console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
        fs.mkdirSync('uploads');
    }
});

/**
 * upload는 미들웨어를 만드는 객체가 된다.
 * 옵션으로 storage,limits 속성을 주었다.
 *  
 * storage에는 파일 저장 방식과 경로, 파일명 등을 설정할 수 있다. 
 * diskStorage를 사용해 이미지가 서버 디스크에 저장되도록 했고 destination 메소드로 저장 경로를 지정했다.
 * 파일명에 업로드 날짜값을 붙이도록 하였는데 파일명이 중복되는 것을 막기 위해서이다.
 * 
 * limits에는 최대 이미지 파일 용량 허용치를 설정할 수 있다.
 * 
 * upload 변수는 미들웨어를 만드는 여러 가지 메소드를 가지고 있다.
 *              - single : 하나의 이미지를 업로드할 때 사용하며 req.file로 객체를 생성한다.
 *              - array : 여러 개의 이미지를 업로드할 때 사용하며 req.file로 객체를 생성한다, 속성 하나에 이미지를 여러 개 업로드
 *  multer  -->
 *              - fileds : 여러 개의 이미지를 업로드할 때 사용하며 req.file로 객체를 생성한다, 여러 개의 속성에 이미지를 하나씩 업로드
 *              - none : 이미지를 올리지 않고 데이터만 multipart 형식으로 전송했을 때
 */
const upload = multer({
    storage : multer.diskStorage({
        destination(req, file, cb) {
            cb(null, 'uploads/');
        },
        filename(req, file, cb) {
            const ext = path.extname(file.originalname);
            cb(null, path.basename(file.originalname, ext) + new Date().valueOf() + ext);
        },
    }),
    limits : {fileSize : 5 * 1024 * 1024},
});

router.post('/img', isLoggedIn, upload.single('img'), (req, res) => {
    console.log(req.file);
    res.json({url : `/img/${req.file.filename}`});
});

const upload2 = multer();
router.post('/', isLoggedIn, upload2.none(), async (req, res, next) => {
    try {
        const post = await Post.create({
            content : req.body.content,
            img : req.body.url,
            userId : req.user.id,
        });
        
        const hashtags = req.body.content.match(/#[^\s]*/g);
        if (hashtags) {
            const result = await Promise.all(hashtags.map(tag => Hashtag.findOrCreate({
                where : { title : tag.slice(1).toLowerCase() },
            })));
            await post.addHashtags(result.map(r => r[0]));
        }
        res.redirect('/');
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/hashtag', async (req, res, next) => {
    const query = req.query.hashtag;
    if (!query) {
        return res.redirect('/');
    }

    try {
        const hashtag = await Hashtag.find({where : {title : query}});
        let posts = [];
        if (hashtag) {
            posts = await hashtag.getPosts({include : [{model : User}] });
        }
        return res.render('main', {
            title : `${query} | NodeBird`,
            user : req.user,
            twits : posts,
        });
    } catch (error) {
        console.error(error);
        return next(error);
    }
});

module.exports = router;