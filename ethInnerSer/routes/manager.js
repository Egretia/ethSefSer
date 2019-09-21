var express = require('express');
var router = express.Router();
var Utils = require("../utils")
var Models = require("../models")

/* GET home page. */
router.get('/resetpkstatus', async function (req, res, next) {
    if(!Config.main.subscribeBlock){
        return res.send(Utils.app.ajax_failed("this project doesn't subscribe HEADER"));
    }

    let pkIndex = Utils.app.safeGetInputNumber(req, "pkIndex", -1);
    let taskId = Utils.app.safeGetInputNumber(req, "taskId", -1);
    let succ = Utils.app.safeGetInputNumber(req, "succ", -1);
    let errmsg = Utils.app.safeGetInput(req, "errmsg", "");

    if (pkIndex==-1 || taskId==-1 || succ==-1) {
        Utils.log.error("resetpkstatus failed param not enough", req.body, req.query) ;
        return res.send(Utils.app.ajax_failed("param not enough "));
    }

    let emsg = await GasManagerInst.resetPkStatus(pkIndex, taskId, succ, errmsg) ;
    if (emsg) {
        return res.send(Utils.app.ajax_failed(emsg));
    }

    return res.send(Utils.app.ajax_success({"msg":"success"}));
});

router.get('/pkstatus', async function (req, res, next) {

    if(!Config.main.subscribeBlock){
        return res.send(Utils.app.ajax_failed("this project doesn't subscribe HEADER"));
    }

    let result = GasManagerInst.getPkStatus()

    return res.send(Utils.app.ajax_success({"pklist":result}));
});

router.get('/addgastask', async function (req, res, next) {

    if(!Config.main.subscribeBlock){
        return res.send(Utils.app.ajax_failed("this project doesn't subscribe HEADER"));
    }

    //0x30056a9d28f768aa0363604660301481b30e5f34 @todo 检查地址是否在地址列表
    let addr = Utils.app.safeGetInput(req, "addr", "") ;
    if (addr=="") {
        return res.send(Utils.app.ajax_failed("param not enough "));
    }

    let result = Models.gasmanager.setTask(addr)

    return res.send(Utils.app.ajax_success({"msg":"success"}));
});

router.get('/flushpkbalance', async function (req, res, next) {

    if(!Config.main.subscribeBlock){
        return res.send(Utils.app.ajax_failed("this project doesn't subscribe HEADER"));
    }

    GasManagerInst.flushPKBalance() ;

    return res.send(Utils.app.ajax_success({"msg":"flush done, please check it later"}));
});

router.get('/flushpkstatus', async function (req, res, next) {

    if(!Config.main.subscribeBlock){
        return res.send(Utils.app.ajax_failed("this project doesn't subscribe HEADER"));
    }

    let addr = Utils.app.safeGetInput(req, "addr", "") ;
    if (addr=="") {
        return res.send(Utils.app.ajax_failed("param not enough "));
    }

    let emsg = GasManagerInst.flushPkStatus(addr) ;
    if (emsg) {
        return res.send(Utils.app.ajax_failed(emsg));
    }

    return res.send(Utils.app.ajax_success({"msg":"flush done, please check it later"}));
});

router.get('/test', async function (req, res, next) {
    var j=0 ;
    for(let i=0;i<10;i++) {
        j=i;
        let k=i;
        setTimeout(function(){
            console.log(i,j,k);
            
        }, 1000*i)
    }
/*
0 9 0
1 9 1
2 9 2
3 9 3
4 9 4
5 9 5
6 9 6
7 9 7
8 9 8
9 9 9
*/

    return res.send(Utils.app.ajax_success({"msg":"flush done, please check it later"}));
});

module.exports = router;
