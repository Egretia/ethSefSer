var Crypto = require('crypto');
var Config = require('../../config')

var checkParam = function(value, type) {
    let result = false ;

    switch(type){
        case "eth_address":
            result = /0x[0-9a-zA-Z]{40}/.test(value);
            break;
    }

    return result ;
}

var safeGetInputNumber = function(req, key, def) {
    let val = def ;

    if(req.query[key] != undefined) {
        val = req.query[key] ;
    }
    if(req.body[key] != undefined) {
        val = req.body[key] ;
    }
    val = parseFloat(val) ;
    
    if(isNaN(val)){
        return def;
    }
    return val;
}

var safeGetInput = function(req, key, def) {
    let val = def ;

    if(req.query[key] != undefined) {
        val = req.query[key] ;
    }
    if(req.body[key] != undefined) {
        val = req.body[key] ;
    }

    val = val.replace(/('|script|frame|>|<)/gi, "") ;
    val = encodeURIComponent(val) ;
    
    return val;
}

var getStageShowString = function (index) {
    let ret = [
        "Initial" ,
        "The 2nd" ,
        "The 3nd" ,
        "The 4nd" ,
        "The 5nd" ,
    ] ;

    if (ret.length < index) {
        return index;
    }

    return ret[index-1] ;
}

var getRateImage = function (rate) {
    return "/images/rate/" + rate + ".png";
}

var getFlagImage = function (countryCode) {
    if(!countryCode){
        return '' ;
    }
    countryCode = countryCode.toLowerCase()
    if(countryCode=='' || countryCode=='xx'){
        return '' ;
    }
    return "/images/phocaflags/" + countryCode + ".png";
}

var getCountryImage = function (countryId) {
    return "/images/country/" + countryId + ".png";
}

var getPlayerImage = function (playerId) {
    return "/images/player/" + playerId + ".png";
}

var getClubImage = function (clubId) {
    return "/images/club/" + clubId + ".png";
}

/**
 * 竞拍活动是否结束
 */
var auctionIsEnd = function () {
    let stageList = Config.main.stage;
    var index = 0;
    var matched = false;
    for (index in stageList) {
        let start = stageList[index].start;
        let end = stageList[index].end;

        start = new Date(start).getTime();
        end = new Date(end).getTime();
        let now = new Date().getTime();

        if (now < end) {
            matched = true;
            break;
        }
    }

    if (index > 0 && !matched) {
        // 遍历了所有阶段，都没有匹配到，代表已结束
        return true;
    }
    return false;
}

/**
 * 获取当前竞拍阶段
 */
var getStage = function () {
    let stageList = Config.main.stage;
    
    var index = 0;
    var isStart = false; 

    for (index in stageList) {
        let start = stageList[index].start;
        let end = stageList[index].end;

        start = new Date(start).getTime();
        end = new Date(end).getTime();
        let now = new Date().getTime();

        

        if (now < end) {

            if(now > start){
                isStart = true;
            }
            break;
        }
    }

    return {
        'stage': index,
        'is_start': isStart 
    };
}

var buildHttpQuery = function (queryCollection) {
    let item = [];
    for (qKey in queryCollection) {
        item.push(qKey + "=" + queryCollection[qKey]);
    }

    return item.join("&");
}

var authcode_decode = function (data) {

    if(!data){
        return false ;
    }

    let secret = Config.main.sessionPwd;
    var decipher = Crypto.createDecipher('aes192', secret);
    var dec = decipher.update(data, 'hex', 'utf8');//编码方式从hex转为utf-8;
    dec += decipher.final('utf8');//编码方式从utf-8;
    return dec;
}

var authcode_encode = function (data) {

    if (typeof (data) != 'string') {
        data = JSON.stringify(data);
    }

    let secret = Config.main.sessionPwd;
    
    var cipher = Crypto.createCipher('aes192', secret);
    var enc = cipher.update(data, 'utf8', 'hex');//编码方式从utf-8转为hex;
    enc += cipher.final('hex');//编码方式从转为hex;
    return enc;
}

var md5 = function (str) {
    var md5sum = Crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
}

var genVerifyCode = function (total) {
    var wordList = 'abcdefehjkmnpqrstuvxyz23456789';
    var code = '';
    for (var i = 0; i < total; i++) {
        var index = Math.random();
        index = parseInt(index * 1000) % 30;
        code = code + wordList[index];
    }
    return code;
}

var createRandom = function (total) {
    var wordList = '1234567890qwertyuiop';
    var salt = '';
    for (var i = 0; i < total; i++) {
        var index = Math.random();
        index = parseInt(index * 1000) % 20;
        salt = salt + wordList[index];
    }
    return salt;
}

var ajax_success = function (data) {
    let ret = {
        code: 0,
        data: data
    };
    return JSON.stringify(ret);
}

var ajax_failed = function (msg, code = 500) {

    let ret = {
        code: code,
        msg: msg
    };
    return JSON.stringify(ret);
}

var getPlatform = function (u) {
    
    var browser = {
        versions: function () {

            return {
                trident: u.indexOf('Trident') > -1, //IE内核 
                presto: u.indexOf('Presto') > -1, //opera内核 
                webKit: u.indexOf('AppleWebKit') > -1, //苹果、谷歌内核 
                gecko: u.indexOf('Gecko') > -1 && u.indexOf('KHTML') == -1,//火狐内核 
                mobile: !!u.match(/AppleWebKit.*Mobile.*/), //是否为移动终端 
                ios: !!u.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/), //ios终端 
                android: u.indexOf('Android') > -1 || u.indexOf('Adr') > -1, //android终端 
                iPhone: u.indexOf('iPhone') > -1, //是否为iPhone或者QQHD浏览器 
                iPad: u.indexOf('iPad') > -1, //是否iPad 
                webApp: u.indexOf('Safari') == -1, //是否web应该程序，没有头部与底部 
                weixin: u.indexOf('MicroMessenger') > -1, //是否微信 （2015-01-22新增） 
                qq: u.match(/\sQQ/i) == " qq" //是否QQ 
            };
        }()
    }

    if (browser.versions.android || browser.versions.iPhone || browser.versions.iPad) {
        return 'h5';
    }
    return 'pc';
}

module.exports = {
    md5: md5,
    createRandom: createRandom,
    authcode_encode: authcode_encode,
    authcode_decode: authcode_decode,
    genVerifyCode: genVerifyCode,
    ajax_success: ajax_success,
    ajax_failed: ajax_failed,
    getPlatform: getPlatform,
    buildHttpQuery: buildHttpQuery,
    getStage: getStage,
    getRateImage: getRateImage,
    getFlagImage: getFlagImage,
    getCountryImage: getCountryImage,
    getPlayerImage: getPlayerImage,
    getClubImage: getClubImage,
    auctionIsEnd: auctionIsEnd,
    getStageShowString: getStageShowString,
    safeGetInput:safeGetInput,
    safeGetInputNumber:safeGetInputNumber,
    checkParam:checkParam,
};