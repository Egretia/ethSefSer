var express = require('express');
var router = express.Router();

const Web3 = require('web3');
const lightwallet = require('../lightwallet');
const Utils = require("../utils");
const Models = require("../models");
const EventHelper = require("../events/event-helper");
const EthWallet = require("ethereumjs-wallet");
const EthereumTx = require('ethereumjs-tx');

const BatchGasPageLimit = 80 ; //正式的 80
const BatchGasLimit = 60000 ; // 给 ERC20 用

lightwallet.keystore.prototype.passwordProvider = function (callback) {
    callback(null, Config.main.walletPwd) ;
}; // 密码提供者

const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        Utils.log.error(`caught error ${err.message}`) ;
        console.error(err);
        next(err);
    });
};

// 该路由使用的中间件
router.use(asyncMiddleware(async (req, res, next) => {
    next();
}));

// 归集ETH，单个
router.all('/collectone', async function(req, res, next){

    let addr = Utils.app.safeGetInput(req, "addr", "") ; //req.query.addr ;
    let addrInfo = await Models.users.getByAddress(addr) ;
    if(!addrInfo){
        return res.send(Utils.app.ajax_failed("address not exists"));
    }

    let platformInfo = await Models.platform.getByAccount(addrInfo.platform) ;
    if(!platformInfo){
        return res.send(Utils.app.ajax_failed("platformInfo not exists"));
    }

    EventHelper.collectETH(addr, platformInfo.p_collect_addr, platformInfo.p_cb_collected, platformInfo.p_key);

    res.send(Utils.app.ajax_success({'msg':'succ'}));
})

// 归集信息
router.all('/collectinfo', async function(req, res, next){
    let appname = Utils.app.safeGetInput(req, "appname", "") ;
    if(!appname) {
        return res.send(Utils.app.ajax_failed("param wrong"));//application does not exist
    }

    let appinfo = await Models.platform.getByAccount(appname) ;
    if(!appinfo){
        return res.send(Utils.app.ajax_failed("application does not exist"));//
    }

    let p_collect_addr = appinfo.p_collect_addr;
    if (!p_collect_addr) {
        // 同时兼容ETH和TOKEN归集，如果平台没有配置单独的收集地址，则去找APP表中和platform 同名的 APP
        let appinfo2 = await Models.apps.getbyaccount(appname) ; 
        if(!appinfo2){
            return res.send(Utils.app.ajax_failed("application 2 does not exist"));//
        }

        p_collect_addr = appinfo2.collect_to ;
    }

    let recentBatchPayGasInfo = {
        created_at:"",
        updated_at:"",
        page:0,
        ptotal:0,
        errinfo:"",
        gas:0
    }
    let _recentBatchPayGasInfo = await Models.batchpaygastx.getNewest() ;
    if (_recentBatchPayGasInfo) {
        recentBatchPayGasInfo.created_at = (new Date(_recentBatchPayGasInfo.created_at)).toLocaleString() ;
        if(_recentBatchPayGasInfo.updated_at>0){
            recentBatchPayGasInfo.updated_at = (new Date(_recentBatchPayGasInfo.updated_at)).toLocaleString() ;
        }
        recentBatchPayGasInfo.page = _recentBatchPayGasInfo.page;
        recentBatchPayGasInfo.ptotal = _recentBatchPayGasInfo.ptotal;
        recentBatchPayGasInfo.errinfo = _recentBatchPayGasInfo.errinfo;
        recentBatchPayGasInfo.gas = _recentBatchPayGasInfo.gas;
    }

    let datatime = (new Date(appinfo.last_ctime*1000)).toLocaleString() ;
    let result = {
        p_account: appinfo.p_account,
        p_collect_addr: p_collect_addr,
        last_ctime: datatime,
        recentBatchPayGasInfo: recentBatchPayGasInfo
    } ;

    res.send(Utils.app.ajax_success(result));
})

// 归集ETH，批量
router.all('/emitcollect', function(req, res, next){
    let appname = Utils.app.safeGetInput(req, "appname", "") ;
    // if(!appname) { // 这里先不判断
    //     return res.send(Utils.app.ajax_failed("param wrong"));//application does not exist
    // }

    EventHelper.collectETHCyc() ;
    res.send(Utils.app.ajax_success({msg:"succ"}));
})

function getAddrsByPage(addrs, page, plimit) {
    if(addrs.length<=0){
        return [] ;
    }

    if(page<=0){
        page = 1 ;
    }

    let start = (page-1)*plimit ;
    let end = start+plimit ;

    let result = addrs.slice(start, end) 
    return result 
}

router.all('/batchpaygasfee_cb', async function(req, res, next){
    
    let p_key = req.query.p_key;
    let page_numb = parseInt(req.query.page_numb); // gwei
    let tx = req.query.tx ;
    let status_flag = req.query.status_flag ;
    let batch_id = req.query.batch_id ;
    
    Utils.log.info(`got batchpaygasfee_cb, ${batch_id} ${page_numb} ${status_flag} ${tx}, will do it in 3 sec`) ;
    if(status_flag=="false"){
        let einfo = `got batchpaygasfee_cb, error status_flag is flase, ${batch_id} ${page_numb} ${status_flag} ${tx}`
        Utils.log.info(einfo) ;
        Models.batchpaygastx.update(batch_id, page_numb, einfo) ;
        return ;
    }

    setTimeout( async ()=>{
        Utils.log.info(`got batchpaygasfee_cb, ${batch_id} ${page_numb} ${status_flag} ${tx}, will do it ...`) ;

        let batchInfo = await Models.batchpaygastx.getById(batch_id) ;
        if(!batchInfo) {
            Utils.log.info(`got batchpaygasfee_cb, error batch does not exist, ${batch_id} ${page_numb}`) ;
            return ;
        }
    
        let addrs = JSON.parse(batchInfo.contents) ;
        page_numb = page_numb+1
        let pdata = getAddrsByPage(addrs, page_numb, BatchGasPageLimit) ; 
    
        if(pdata.length<=0){
            Utils.log.info(`got batchpaygasfee_cb, error got 0 items, ${batch_id} ${page_numb}`) ;
            return ;
        }
    
        // init web3
        let reqdata = {
            "address": pdata , 
            "amount": batchInfo.gas+"" ,
            "page_numb": page_numb+"" ,
            "batch_id": batch_id+"" ,
        }
        
        reqdata = JSON.stringify(reqdata) ;
        let postresp = await Utils.http.post(Config.main.paygasContractHost, reqdata) ;
        
        if (!postresp) {
            Utils.log.info(`got batchpaygasfee_cb, error request batch-server failed: , ${batch_id} ${page_numb}`) ;
            return ;
        }
        
        postresp = JSON.parse(postresp)
        if(postresp.code!=0) {
            Utils.log.info(`got batchpaygasfee_cb, error request batch-server failed: , ${postresp.tips} ${batch_id} ${page_numb}`) ;
            return ;
        }
    
        Utils.log.info(`got batchpaygasfee_cb, success ${batch_id} ${page_numb}`) ;
        Models.batchpaygastx.update(batch_id, page_numb, "") ;
    }, 3000) ;

    res.send(Utils.app.ajax_success({
        'msg':'success'
    }));
})

// 批量打GAS费 
router.all('/batchpaygasfee', async function(req, res, next){
    let platform = req.query.platform;
    let gasPrice = req.query.gasprice; // gwei
    let symbol = Utils.app.safeGetInput(req, "symbol", "egt") ;
    let recollect = Utils.app.safeGetInput(req, "recollect", "no") ;

    let platformInfo = await Models.platform.getByAccount(platform) ;
    if (!platformInfo) {
        return res.send(Utils.app.ajax_failed("application does not exist"));//application does not exist
    }
    if (!platformInfo.p_cb_addr) {
        return res.send(Utils.app.ajax_failed("application did not config p_cb_addr"));
    }

    let addrs = [] ;
    let recoverIds = [] ; // 需要重新打GAS费用的 eth_collect.id , 

    if(recollect=="yes"){
        // 重新打归集用的GAS费用
        let erritems = await Models.egtcollect.getErrItems(symbol) ;
        if (!erritems) {
            return res.send(Utils.app.ajax_failed("not found any droped transaction"));
        }

        for (let i in erritems) {
            addrs.push(erritems[i].address) ;
            recoverIds.push(erritems[i].id) ;
        }
    }else{
        let url = platformInfo.p_cb_addr+"?last_time="+platformInfo.last_ctime+"&query_key="+platformInfo.queryk+"&symbol="+symbol;
        let hresult = await Utils.http.get(url) ;
        if(!hresult) {
            return res.send(Utils.app.ajax_failed("query addresses for incharge failed"));
        }

        let parsedData = JSON.parse(hresult);
        if(parsedData.code >0 ){
            Utils.log.error(`batchpaygasfee get ${url} err: ${parsedData.msg}`);
            return res.send(Utils.app.ajax_failed("request p_cb_addr error: "+parsedData.msg));
        }
        
        if (parsedData.data.addrs.length <= 0){
            return res.send(Utils.app.ajax_failed("request p_cb_addr , got 0 items "));
        }

        
        for (let i=0; i<parsedData.data.addrs.length; i++) {
            if(Utils.app.checkParam(parsedData.data.addrs[i], "eth_address")) {
                addrs.push(parsedData.data.addrs[i]) ;
            }
        }
    }

    if (addrs.length <= 0){
        return res.send(Utils.app.ajax_failed("request p_cb_addr , got 0 items "));
    }

    // 校验地址是否存在
    let _checkAddrsCount = await Models.users.countByAddresses(addrs) ;
    
    if(_checkAddrsCount!=addrs.length){
        return res.send(Utils.app.ajax_failed("request p_cb_addr , got some illegal address "));
    }

    // init web3
    let web3inner = new Web3();
    web3inner.setProvider(new Web3.providers.HttpProvider(Config.main.ethnet));
    gasPrice = web3inner.toWei(gasPrice, "gwei") ;
    
    let gas = BatchGasLimit*gasPrice ; // wei
    gas = web3inner.fromWei(gas, "ether") ;

    let addrsContent = JSON.stringify(addrs) ; // 10,000 EGT 归集
    let pagetotal = Math.ceil(addrs.length/BatchGasPageLimit) ;
    let batchId = await Models.batchpaygastx.save(addrsContent,gas, pagetotal) ;
    if (!batchId) {
        return res.send(Utils.app.ajax_failed("save TX failed"));
    }

    let pdata = getAddrsByPage(addrs, 1, BatchGasPageLimit) ; 

    let reqdata = {
        "address": pdata , 
        "amount": gas+"" ,
        "page_numb": 1+"" ,
        "batch_id": batchId+"" ,
    }
    
    reqdata = JSON.stringify(reqdata) ;
    let postresp = await Utils.http.post(Config.main.paygasContractHost, reqdata) ;

    if (!postresp) {
        return res.send(Utils.app.ajax_failed("request batch-server failed"));
    }

    postresp = JSON.parse(postresp)
    if(postresp.code!=0) {
        return res.send(Utils.app.ajax_failed("request batch-server failed: "+postresp.tips));
    }

    res.send(Utils.app.ajax_success({
        'msg':'success'
    }));
})

// 归集TOKEN，批量
router.all('/emitcollecttoken', function(req, res, next){
    let appname = Utils.app.safeGetInput(req, "appname", "") ;
    let symbol = Utils.app.safeGetInput(req, "symbol", "egt") ;
    let recollect = Utils.app.safeGetInput(req, "recollect", "no") ;

    // if(!appname) { // 这里先不判断
    //     return res.send(Utils.app.ajax_failed("param wrong"));//application does not exist
    // }

    symbol = symbol.toLowerCase() ;

    if(recollect=="yes"){
        EventHelper.recollectTokenCyc(symbol) ;
    }else{
        EventHelper.collectTokenCyc(symbol) ;
    }

    res.send(Utils.app.ajax_success({msg:"succ"}));
})

// 显示错误归集列表
router.all("/errcollects", async function(req, res, next){
    let symbol = Utils.app.safeGetInput(req, "symbol", "egt") ;
    let erritems = await Models.egtcollect.getErrItems(symbol) ;
    if (!erritems) {
        return res.send(Utils.app.ajax_failed("not found any droped transaction"));
    }
    let dl = [] ;
    for (let i in erritems) {
        dl.push({
            address: erritems[i].address,
            err_info: erritems[i].err_info,
        }) ;
    }

    res.send(Utils.app.ajax_success({datalist:dl}));
})

// Get balance of big-wallet 
router.get('/bigwalletbalance', async function (req, res, next) {

    
    let platform = req.query.platform;
    let key = decodeURI(req.query.key);
    
    let platformInfo = await Models.platform.getByAccount(platform) ;
    if (!platformInfo) {
        return res.send(Utils.app.ajax_failed("platform does not exist"));
    }

    if (platformInfo.p_key != key) {
        return res.send(Utils.app.ajax_failed("invaild key"));
    }

    let fromAddr = platformInfo.p_withdraw_addr;
    
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    var walletBalance = await ethAgent.getERC20Balance(Config.main.tokenAddr, fromAddr);

    let retObj = {
        'walletBalance': walletBalance
        
    };
    res.send(Utils.app.ajax_success(retObj));
})

// 获取app name list
router.all('/getoutapplist', async function(req, res, next){
    let result = await Models.apps.getall() ;
    let data = [] ;
    for (let i in result) {
        data.push({
            'account': result[i].account,
            'appdesc': result[i].appdesc,
        });
    }

    res.send(Utils.app.ajax_success({
        'list':data
    }));
})

// 获取归集地址列表
router.all('/getcollectlist', async function(req, res, next){
    let symbol = Utils.app.safeGetInput(req, "symbol", "") ;
    let outerAppname = Utils.app.safeGetInput(req, "outappname", "") ;
    if(!symbol){
        return res.send(Utils.app.ajax_failed("params wrong"));
    }
    symbol = symbol.toLowerCase() ;

    let page = Utils.app.safeGetInput(req, "page", "1") ;
    page = parseInt(page) ;
    page = page>0 ? page : 1 ;

    let pagesize = Utils.app.safeGetInput(req, "pagesize", "10") ;
    pagesize = parseInt(pagesize) ;
    pagesize = pagesize>0 ? pagesize : 10 ;

    let appname = "egretia" ;
    let appinfo = await Models.platform.getByAccount(appname) ;
    if(!appinfo){
        return res.send(Utils.app.ajax_failed("application not found"));
    }

    let url = `${Config.main.outerApiUrl}/innerapi/list?symbol=${symbol}&appname=${outerAppname}&qkey=${appinfo.queryk}&page=${page}&pagesize=${pagesize}` ;
    let result = await Utils.http.get(url) ;
    if(!result){
        console.error(`request falied: response illegal ${url} ${result}`) ;
        return res.send(Utils.app.ajax_failed("request falied: response illegal"));
    }

    let resultObj = JSON.parse(result) ;
    if(!resultObj) {
        console.error(`request falied: response illegal ${url} ${result}`) ;
        return res.send(Utils.app.ajax_failed("request falied: response illegal"));
    }

    if(resultObj.code>0){
        return res.send(Utils.app.ajax_failed("request falied: "+resultObj.msg));
    }

    let retObj = {
        'list': resultObj.data.data ,
        "pagination": {
            "total": 200,
            "pageSize": pagesize,
            "current": page
        }
    }
    res.send(Utils.app.ajax_success(retObj));
})

// 归集 TOKEN 单个
router.all('/collecttokenone', async function(req, res, next){
    
    let addr = Utils.app.safeGetInput(req, "address", "") ; // req.query.address;
    let symbol = Utils.app.safeGetInput(req, "symbol", "") ; // req.query.token;
    let appaccount = Utils.app.safeGetInput(req, "appaccount", "") ; // req.query.token;
    
    let addrinfo = await Models.users.getByAddress(addr);
    if (!addrinfo) {
        return res.send(Utils.app.ajax_failed("address for collection not found"));
    }

    let platform = await Models.platform.getByAccount(addrinfo.platform) ;
    if(!platform) {
        return res.send(Utils.app.ajax_failed("platform not found"));
    }
    if(!platform.p_collect_addr){
        return res.send(Utils.app.ajax_failed("platform did not set an address "));
    }

    let appinfo = await Models.apps.getbyaccount(appaccount) ;
    if(!appinfo) {
        return res.send(Utils.app.ajax_failed("APP not found"));
    }

    // 该地址是否有正在进行的EGT收集
    if (await Models.egtcollect.isCollecting(addr)) {
        return res.send(Utils.app.ajax_failed("address is collecting"));
    }

    let tokenInfo = await Models.token.getBySymbol(symbol) ;
    if(!tokenInfo){
        return res.send(Utils.app.ajax_failed("token info of address not found"));
    }

    // init web3
    let web3 = new Web3();
    
    web3.setProvider(new Web3.providers.HttpProvider(Config.main.ethnet));

    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let retArr = await Promise.all([ethAgent.getERC20Balance(tokenInfo.contract_addr, addr), ethAgent.getBalance(addr)]) ;
    
    let token_balance = parseFloat(retArr[0]) ;
    let eth_balance = parseFloat(retArr[1]) ;
    
    if (token_balance <= 0){
        return res.send(Utils.app.ajax_failed("TOKEN balance is not enough"));
    }

    // let tVal = web3.toWei(token_balance, "ether");
    let tVal = token_balance;
    let ethVal = web3.toWei(eth_balance, "ether");
    toAddr = platform.p_collect_addr ;

    var gasLimit = 60000 ; //web3.eth.estimateGas(stInfo) * 4;
    var gasPrice = parseFloat(web3.eth.gasPrice) * 2;
    var estimateEth = gasPrice*gasLimit ;

    let collected = 0 ;
    let tokenBalanceInfo = await Models.token.getBalanceInfoBySymbol(symbol, addr) ;
    if(tokenBalanceInfo){
        collected = tokenBalanceInfo.collected ;
    }

    // 创建提款
    let collectData = {
        platform: platform.p_account,
        appaccount: appaccount,
        address: addr ,
        apply_id: 0 ,
        symbol: symbol ,
        collected_now: collected , // ether
        collect_need: tVal , // ether
        status: Models.egtcollect.STATUS_CREATE ,
        gas_limit: gasLimit , // wei
        gas_price: gasPrice   // wei
    }
    
    let cid = await Models.egtcollect.add(collectData);
    if(!cid){
        return res.send(Utils.app.ajax_failed("recharge eth failed : insert collect failed "));
    }
    
    var collectFlag = true;
    if (ethVal<estimateEth){
        
        if (process.env.addEthGas == 1){
            return res.send(Utils.app.ajax_failed("Big wallet is sending ETH"));
        }
        collectFlag = false;
        // 需要充值
        let rechargeRet = await rechargeForCollect(platform.p_account, addr, estimateEth)
        if (rechargeRet.err) {
            return res.send(Utils.app.ajax_failed("recharge eth failed : "+rechargeRet.err));
        }else{
            //  rechargeRet.hash 提交到后台，等待完成，提交egt提款
            await Models.egtcollect.recordEthGas(cid, estimateEth, rechargeRet.hash) ;
            
            EventHelper.txEventAdd(rechargeRet.hash, "sendEthForCollectToken", {
                cid:cid,
                contractAddr:tokenInfo.contract_addr
            }) ;
        }
    }

    if(collectFlag){
        // 提交egt提款
        await EventHelper.addTokenCollect(cid,tokenInfo.contract_addr) ;
    }

    return res.send(Utils.app.ajax_success({"msg":"succ"}));
})

/**
 * 归集 TOKEN 充值 GAS
 * @param {string} platform 
 * @param {string} toAddr 
 * @param {int} ethnum (wei) 
 */
async function rechargeForCollect(platform, toAddr, ethnum) {

    return new Promise(async function (resole, reject) {
        
        // init web3
        let web3 = new Web3();

        var prikey = Config.main.rechargePK ;
        var privateKey = Buffer.from(prikey, 'hex')
        var priInst = EthWallet.fromPrivateKey(privateKey);
        var fromAddr = "0x" + priInst.getAddress().toString("hex")

        web3.setProvider(new web3.providers.HttpProvider(Config.main.ethnet));
        
        let stInfo = {}
        stInfo.from = fromAddr;
        stInfo.to = toAddr;
        stInfo.value = web3.toHex(ethnum);

        var gasLimit = 60000 ; // gas limit 转账 21000 ，智能合约转账 60000
        var gasPrice = parseFloat(web3.eth.gasPrice) *1.2;

        stInfo.gas = web3.toHex(gasLimit);
        stInfo.gasPrice = web3.toHex(gasPrice);

        const tx = new EthereumTx(stInfo)
        tx.sign(privateKey)
        const serializedTx = tx.serialize()

        var txstr = serializedTx.toString("hex")

        if (txstr.substr(0,2)!='0x'){
            txstr = '0x'+txstr ;
        }

        web3.eth.sendRawTransaction(txstr, function(err, txhash) {
            if (err) {
                console.error(err) ;
                Utils.log.error("send ETH failed ", err.message) ;
                resole({
                    hash: "" ,
                    err: err.message
                }) ;
            } else {
                process.env.addEthGas = 1 ;
                Utils.log.info("send ETH done ", txhash) ;
                resole({
                    hash: txhash ,
                    err: ""
                }) ;
            } 
        });
    })
}

// 批量生成eth地址
router.get('/generateaddrs', async function (req, res, next) {
    let commonWalletPwd = Config.main.walletPwd;
    let platform = req.query.platform;
    let num = req.query.num;  // 助记词数量

    if(num>1000){
        num = 1000 ;
    }

    if (!platform) {
        return res.send(Utils.app.ajax_failed("params wrong"));
    }

    for (let k=0; k<num; k++){

        try {
            var walletObj = await Utils.eth.createWallet(commonWalletPwd);
        } catch (e) {
            console.error(e);
            Utils.log.error(`batch create address failed ${e.message}`)
            return res.send(Utils.app.ajax_failed("create wallet failed"));
        }
    
        if (!walletObj) {
            return res.send(Utils.app.ajax_failed("create wallet failed"));
        }
    
        let mnemonic = walletObj.mnemonic;
        let addresses = await Utils.eth.newAddresses(walletObj.ks, commonWalletPwd, 100);
    
        if (!addresses) {
    
            return res.send(Utils.app.ajax_failed("create wallet address failed"));
        }
    
        var mid = null;
        try {
            mid = await Models.wallet.save({
                "platform": platform,
                "mnemonic": mnemonic,
                "ks": walletObj.ks.serialize()
            });
        } catch (e) {
            Utils.log.error(e);
        }
    
        if (!mid) {
            return res.send(Utils.app.ajax_failed("create account failed"));
        }
    
        for (let i in addresses) {
            try {
                insertId = await Models.users.save({
                    "address": addresses[i] ,
                    "platform": platform,
                    "mid": mid,
                    "mindex": i
                });
            } catch (e) {
                Utils.log.error(e);
            }
        }
    
        // SubHeader.addAddr(address,platform) // 将地址添加到块列表，用来快速排查以太坊出块是否跟我们有关系           
    }

    let retObj = {
        "msg": "success"
    };

    res.send(Utils.app.ajax_success(retObj));
});

module.exports = router;
