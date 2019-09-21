var express = require('express');
var router = express.Router();
const lightwallet = require('../lightwallet');
const Utils = require("../utils");
const Models = require("../models");
const Http = require('http');


lightwallet.keystore.prototype.passwordProvider = function (callback) {
    callback(null, Config.main.walletPwd) ;
}; // 密码提供者

const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        // if (!err.isBoom) {
        //   return next(boom.badImplementation(err));
        // }
        console.log(err);
        next(err);
    });
};

// 该路由使用的中间件
router.use(asyncMiddleware(async (req, res, next) => {

    next();
}));

router.get('/monitoraddr', async function (req, res, next) {
    
    let address = req.query.address;

    SubHeader.addAddr(address) // 将地址添加到块列表，用来快速排查以太坊出块是否跟我们有关系

    let retObj = {
        "msg": "success",
        "address": address
    };

    res.send(Utils.app.ajax_success(retObj));
});



router.get('/notifyethbalance', async function(req, res, next){
    // 
    let addr = req.query.addr;
    if(!addr){
        return res.send(Utils.app.ajax_failed("params wrong: addr null"));
    }

    let addrInfo = await Models.users.getByAddress(addr);
    if(!addrInfo){
        return res.send(Utils.app.ajax_failed("params wrong: addr not found"));
    }

    let inchargeCallback = Config.main.inchargeCallback ;
    let pkey = Config.main.pKey;
    Http.get(inchargeCallback+"?p_key="+pkey+"&address="+addr, (res) => {
        console.log("incharge callback done http code : ", res.statusCode) ;
    }).on('error', (e) => {
        console.error(`incharge callback err: ${e.message}`);
    });

    // let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    // let balanceNow = await ethAgent.getBalance(addr);
    // let addrInfo = await Models.users.updateBalance(addr,balanceNow);
    // if(!addrInfo){
    //     return res.send(Utils.app.ajax_failed("params wrong: addr not found"));
    // }
    
    // if(addrInfo){
    //     let realBalance = addrInfo.balance+addrInfo.collected ;
    //     Http.get(inchargeCallback+"?p_key="+pkey+"&address="+addr+"&balance="+realBalance, (res) => {
    //         console.log("incharge callback done http code : ", res.statusCode) ;
    //     }).on('error', (e) => {
    //         console.error(`incharge callback err: ${e.message}`);
    //     });
    // }else{
        
    //     return res.send(Utils.app.ajax_failed("params wrong: address info not found"));
    // }

    return res.send(Utils.app.ajax_success({"msg":"success"}));
})


module.exports = router;