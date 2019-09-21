const EventEmitter = require('events').EventEmitter ;
const Web3 = require('web3');
const HookedWeb3Provider = require("../utils/hooked-web3-provider");
const lightwallet = require('../lightwallet');
const Config = require('../config');
const Http = require('http');
const Models = require("../models");
const Utils = require("../utils") ;

const TokenCollectLimit = 10000 ;

lightwallet.keystore.prototype.passwordProvider = function (callback) {
    callback(null, Config.main.walletPwd) ;
}; // 密码提供者

var Event = new EventEmitter() ;
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(Config.main.ethnet));

var gasPriceCache = 20000000000 ; // 20 Gwei 

// 归集以太币
Event.on('add-eth-collect', function(inputData){
    
    Utils.log.info("recive add-eth-collect event input data ", inputData) ;

    let _timmer = null ;

    _timmer = setInterval(function(){

        web3.eth.getTransaction(inputData.recvTxHash, function(_transactionErrMsg, _transactionData){
            if (_transactionErrMsg) {
                Utils.log.error("add-eth-collect getTransaction error: ", inputData, _transactionErrMsg) ;
                clearInterval(_timmer) ;
                _timmer = null ;
                return false;
            }

            if (_transactionData && _transactionData.blockNumber) {
                

                // 矿工已经完成，请求票据
                web3.eth.getTransactionReceipt(inputData.recvTxHash, function(_receiptErrMsg, _receiptData){
                    
                    if (_receiptErrMsg) {
                        clearInterval(_timmer) ;
                        _timmer = null ;
                        Utils.log.error("add-eth-collect getTransactionReceipt error: ", inputData, _receiptErrMsg, _receiptData) ;
                        return false;
                    }else{
                        if(!_receiptData){
                            Utils.log.info("add-eth-collect event receipt data is null , continue ...")
                            return true;
                        }
                        Utils.log.info("add-eth-collect event getTransactionReceipt data: ", _receiptData) ;

                        clearInterval(_timmer) ;
                        _timmer = null ;
                        
                        if(!web3.toDecimal(_receiptData.status)){
                            // 0x0
                            Utils.log.error("add-eth-collect event getTransactionReceipt error: status 0x0", inputData) ;
                            
                        }else{
                            // 0x1
                            // 记录日志，回调
                            let gasPrice = _transactionData.gasPrice ;
                            let gasUsed = _receiptData.gasUsed ;
                            let gasAmount = web3.fromWei(gasUsed*gasPrice, "ether") ;
                            gasAmount = parseFloat(gasAmount) ;
                            let ethAmount = web3.fromWei(_transactionData.value, "ether") ;
                            ethAmount = parseFloat(ethAmount) ;
                            let now = parseInt((new Date()).getTime()/1000);
                            let save = {
                                address:_transactionData.from ,
                                tx:_transactionData.hash,
                                eth:ethAmount,
                                gas:gasAmount,
                                amount:ethAmount+gasAmount,
                                created_at:now
                            }
                            Models.query.sql_insert_ex("eth_collect_log", save) ;

                            // 回调
                            let url = `${inputData.callbackUrl}?pkey=${inputData.pKey}&addr=${save.address}&collected=${save.amount}&txhash=${_transactionData.hash}`;
                            try{
                                Http.get(url , (res) => {
                                    Utils.log.info(`add-eth-collect event ${url} callback done http code : ${res.statusCode}`) ;
                                }).on('error', (e) => {
                                    Utils.log.error(`add-eth-collect event ${url} callback err: ${e.message}`);
                                });
                            }catch(e){
                                Utils.log.error(`add-eth-collect event ${url} error ${e.message}`, inputData);
                            }
                            
                        }

                        return true;
                    }
                    
                }) ;
            }

        })

    }, 10000) ; // 每 10 秒请求

	Utils.log.info('end');
}) ;

async function collectETHCyc(){
    let platforms = await Models.platform.getAll() ;
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    if(platforms){
        for(let i in platforms) {
            
            if(platforms[i].p_cb_addr && platforms[i].p_cb_collected && platforms[i].p_collect_addr){
                let url = platforms[i].p_cb_addr+"?last_time="+platforms[i].last_ctime+"&query_key="+platforms[i].queryk+"&symbol=eth";
                Http.get(url, (res) => {
                    Utils.log.info(`collect-eth get ${url} done http code : ${res.statusCode}`) ;
                    res.setEncoding('utf8');
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', async () => {
                        try {
                            let parsedData = JSON.parse(rawData);
                            if(parsedData.code >0 ){
                                Utils.log.error(`collect-eth get ${url} err: ${parsedData.msg}`);
                            }else{
                                let unixtime = parsedData.data.now ;
                                Models.query.sql_update(`update eth_platform set last_ctime=${unixtime} where id=${platforms[i].id}`) ;
                                if(parsedData.data.addrs.length>0){
                                    Utils.log.info(`collect-eth get ${parsedData.data.addrs.length} item need to collect ...`);
                                    let k = 0 ;
                                    for (let a in parsedData.data.addrs){

                                        let fromAddr = parsedData.data.addrs[a] ;
                                        let balance = await ethAgent.getBalance(fromAddr) ;
                                        if(balance<1){ 
                                            Utils.log.info(`Addr ${fromAddr} balance not enough for collect ${balance}`) ;
                                            continue ;
                                        }
                                        setTimeout(function(){
                                            collectETH(parsedData.data.addrs[a], platforms[i].p_collect_addr, platforms[i].p_cb_collected, platforms[i].p_key);
                                        }, 20000*k)
                                        k = k+1 ;
                                    }
                                }else{
                                    Utils.log.info(`collect-eth get 0 item need to collect ...`);
                                }
                            }
                        } catch (e) {
                            Utils.log.error(e.message);
                        }
                    });
                }).on('error', (e) => {
                    Utils.log.error(`collect-eth get ${url} err: ${e.message}`);
                });
            }
        }
    }
}

async function collectETH(fromAddr, toAddr, callbackUrl, pKey) {

    let userinfo = await Models.users.getByAddress(fromAddr);
    if(!userinfo){
        Utils.log.error(`Addr info not found ${fromAddr}`) ;
        return false;
    }

    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let balance = await ethAgent.getBalance(userinfo.address) ;
    if(balance<0.001){ 
        Utils.log.info(`Addr ${fromAddr} balance not enough for collect ${balance}`) ;
        return false;
    }
    
    let walletinfo = await Models.wallet.getById(userinfo.mid) ;
    var buffer = new Buffer(walletinfo.ks);
    var keyStore = lightwallet.keystore.deserialize(buffer.toString())
    
    // init web3
    let web3inner = new Web3();
    
    var web3Provider = new HookedWeb3Provider({
        host: Config.main.ethnet,
        transaction_signer: keyStore
    });

    web3inner.setProvider(web3Provider);
    balance = web3inner.toWei(balance, 'ether') ;

    // var tCount = web3inner.eth.getTransactionCount(fromAddr);
    let stInfo = {}
    // stInfo.nonce = web3inner.toHex(tCount);
    stInfo.from = fromAddr;
    stInfo.to = toAddr;
    stInfo.value = web3inner.toHex(1);
 
    var gasLimit = 0 ;
    try{
        gasLimit = web3inner.eth.estimateGas(stInfo) ;
    }catch(e){
        Utils.log.error(`estimateGas ${e}`) ;
        gasLimit = 21000 ;
    }
    gasLimit = gasLimit*2;

    var gasPrice = 0 ;

    try{
        gasPrice = parseFloat(web3inner.eth.gasPrice)*2;
        gasPriceCache = gasPrice;
    }catch(e){
        Utils.log.error(`gasPrice ${e}`) ;
        gasPrice = gasPriceCache ;
    }
 
    stInfo.gas = web3inner.toHex(gasLimit);
    stInfo.gasPrice = web3inner.toHex(gasPrice);

    var collectAmount = balance - gasLimit*gasPrice ;

    Utils.log.info(`Addr ${fromAddr} balance ${balance} ${collectAmount} will collect ...`)

    stInfo.value = web3inner.toHex(collectAmount);

    web3inner.eth.sendTransaction(stInfo, function (err, txhash) {
        if (err) {
            Utils.log.error(`send ETH failed ${err}` ) ;
        } else {
            Utils.log.info(`send ETH done ${txhash}` ) ;
            let inputData = {
                recvTxHash: txhash,
                callbackUrl: callbackUrl,
                pKey:pKey
            } ;

            Event.emit('add-eth-collect', inputData);
        } 
    })

    return true ;
}

async function collectTokenCyc(symbol){
    let tokenInfo = await Models.token.getBySymbol(symbol) ;
    if(!tokenInfo){
        Utils.log.error("collectTokenCyc: token "+symbol+" info of address not found") ;
        return "token "+symbol+" info of address not found";
    }

    let platforms = await Models.platform.getAll() ;
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    if(platforms){
        for(let i in platforms) {

            let appinfo = await Models.apps.getbyaccount(platforms[i].p_account) ;
            if(!appinfo){
                Utils.log.error(`collectTokenCyc: app not exist ${platforms[i].p_account}`)
                continue ;
            }

            let supportTokens = platforms[i].p_currencies.split(",") ;
            if(!supportTokens.includes(symbol)){
                Utils.log.error("platform "+platforms[i].p_account+" doesnot support "+symbol) ;
                continue ;
            }
            
            if(platforms[i].p_cb_addr){
                let url = platforms[i].p_cb_addr+"?last_time="+appinfo.last_ctime+"&query_key="+platforms[i].queryk+"&symbol="+symbol;
                Http.get(url, (res) => {
                    Utils.log.info(`collect-token get ${url} done http code : ${res.statusCode}`) ;
                    res.setEncoding('utf8');
                    let rawData = '';
                    res.on('data', (chunk) => { rawData += chunk; });
                    res.on('end', async () => {
                        try {
                            let parsedData = JSON.parse(rawData);
                            if(parsedData.code >0 ){
                                Utils.log.error(`collect-token get ${url} err: ${parsedData.msg}`);
                            }else{
                                let unixtime = parsedData.data.now ;
                                Models.query.sql_update(`update eth_apps set last_ctime=${unixtime} where id=${appinfo.id}`) ;
                                if(parsedData.data.addrs.length>0){
                                    Utils.log.info(`collect-token get ${parsedData.data.addrs.length} item need to collect ...`);
                                    let k = 0 ;
                                    for (let a in parsedData.data.addrs){

                                        let fromAddr = parsedData.data.addrs[a] ;

                                        if (await Models.egtcollect.isCollecting(fromAddr)) {
                                            Utils.log.error("address "+fromAddr+" is collecting") ;
                                            continue ;
                                        }
                                        
                                        let tokenBalance = await ethAgent.getERC20Balance(tokenInfo.contract_addr, fromAddr) ;
                                        if(tokenBalance<TokenCollectLimit){ 
                                            Utils.log.info(`Addr ${fromAddr} balance not enough for collect ${tokenBalance}`) ;
                                            continue ;
                                        }
                                        setTimeout( async function(){

                                            let collected = 0 ;
                                            let tokenBalanceInfo = await Models.token.getBalanceInfoBySymbol(symbol, parsedData.data.addrs[a]) ;
                                            if(tokenBalanceInfo){
                                                collected = tokenBalanceInfo.collected ;
                                            }

                                            // 创建提款
                                            let collectData = {
                                                platform: platforms[i].p_account,
                                                appaccount: platforms[i].p_account,
                                                address: parsedData.data.addrs[a] ,
                                                apply_id: 0 ,
                                                symbol: symbol ,
                                                collected_now: collected , // ether
                                                collect_need: 0 , // ether
                                                status: Models.egtcollect.STATUS_CREATE ,
                                                gas_limit: 0 , // wei
                                                gas_price: 0   // wei
                                            }
                                            Utils.log.info(collectData);
                                            let cid = await Models.egtcollect.add(collectData);
                                            if(!cid){
                                                return res.send(Utils.app.ajax_failed("recharge eth failed : insert collect failed "));
                                            }

                                            addTokenCollect(cid, tokenInfo.contract_addr) ;
                                        }, 20000*k)
                                        k = k+1 ;
                                    }
                                }else{
                                    Utils.log.info(`collect-token get 0 item need to collect ...`);
                                }
                            }
                        } catch (e) {
                            Utils.log.error(e.message);
                        }
                    });
                }).on('error', (e) => {
                    Utils.log.error(`collect-token get ${url} err: ${e.message}`);
                });
            }
        }
    }
}

async function recollectTokenCyc(symbol){
    let tokenInfo = await Models.token.getBySymbol(symbol) ;
    if(!tokenInfo){
        Utils.log.error("token "+symbol+" info of address not found") ;
        return "token "+symbol+" info of address not found";
    }

    let erritems = await Models.egtcollect.getErrItems(symbol) ;
    if (!erritems) {
        Utils.log.error("not found any droped transaction") ;
        return "not found any droped transaction";
    }
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    Utils.log.info(`collect-token get ${erritems.length} item need to collect ...`);
    let k = 0 ;
    for (let i in erritems) {
        let collectData = erritems[i] ;
        let fromAddr = collectData.address ;

        if (await Models.egtcollect.isCollecting(fromAddr)) {
            Utils.log.error("address "+fromAddr+" is collecting") ;
            continue ;
        }
        
        let tokenBalance = await ethAgent.getERC20Balance(tokenInfo.contract_addr, fromAddr) ;
        if(tokenBalance<TokenCollectLimit){ 
            Utils.log.info(`Addr ${fromAddr} balance not enough for collect ${tokenBalance}`) ;
            continue ;
        }
        setTimeout( async function(){
            Utils.log.info(collectData);
            addTokenCollect(collectData.id, tokenInfo.contract_addr) ;
        }, 20000*k)
        k = k+1 ;
    }
    
}

async function addTokenCollect(cid,contract_addr) {
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let collectInfo = await Models.egtcollect.getById(cid) ;
    if (!collectInfo) {
        return false;
    }
    let addrinfo = await Models.users.getByAddress(collectInfo.address);
    if(!addrinfo){
        Utils.log.error(`addTokenCollect: addr not exist ${collectInfo.address}`)
        return false;
    }

    let walletinfo = await Models.wallet.getById(addrinfo.mid);
    let appinfo = await Models.apps.getbyaccount(collectInfo.appaccount) ;

    if(!appinfo){
        Utils.log.error(`addTokenCollect: app not exist ${collectInfo.appaccount}`)
        return false;
    }
    
    let fromAddr = collectInfo.address ;
    let toAddr = appinfo.collect_to ;
    
    if(!Utils.app.checkParam(fromAddr,"eth_address") || !Utils.app.checkParam(toAddr,"eth_address")) {
        Utils.log.error(`addTokenCollect: address format wrong ${fromAddr} ${toAddr}`);
        return false;
    }
    
    var buffer = new Buffer(walletinfo.ks);
    var keyStore = lightwallet.keystore.deserialize(buffer.toString());
    
    // init web3
    let web3inner = new Web3();
    
    let web3innerProvider = new HookedWeb3Provider({
        host: Config.main.ethnet,
        transaction_signer: keyStore
    });
    web3inner.setProvider(web3innerProvider);
    
    var gasLimit = 60000 ;
    var gasPrice = 0 ;

    try{
        gasPrice = parseFloat(web3inner.eth.gasPrice)*1.5;
        gasPriceCache = gasPrice;
    }catch(e){
        Utils.log.error(`gasPrice ${e}`) ;
        gasPrice = gasPriceCache ;
    }
 
    // var nonce = web3inner.eth.getTransactionCount(fromAddr);
    // egtVal = web3.toWei(egt_balance, "ether");

    let tokenBalance = await ethAgent.getERC20Balance(contract_addr, fromAddr) ;
    if(tokenBalance<TokenCollectLimit){ 
        Utils.log.info(`Addr ${fromAddr} balance not enough for collect ${tokenBalance}`) ;
        return ;
    }
    let egtVal = web3inner.toHex(web3inner.toWei(tokenBalance, "ether"));
    
    // 传递给 lightwallet.txutils.valueTx 的值，需要转换成16进制，因为 web3的 web3.eth.sendRawTransaction 中需要的就是 16进制数据
    var transactionObject = {
        //nonce: web3inner.toHex(nonce) ,
        from: fromAddr,
        value: "0x0",
        gas: web3inner.toHex(gasLimit),
        gasPrice: web3inner.toHex(gasPrice),
    };
    Utils.log.info("contract ", contract_addr)
    let abi = Utils.erc20abi.abi ;
    var calcContract = web3inner.eth.contract(abi);
    var contractInstance = calcContract.at(contract_addr);

    var recvTxHash = false ;    
    var recvError = false ;

    await (async ()=>{
        return new Promise(function (resole, reject) {
            
            contractInstance.transfer.sendTransaction(toAddr, egtVal, transactionObject,
                function (err, txhash) {
                    if (err) {
                        console.error(err)
                        Utils.log.error("addEgtCollect send ERC20 Token failed ", err.message)
                        recvTxHash = false ;
                        recvError = err.message ;
                    } else {
                        Utils.log.info("addEgtCollect send ERC20 token done ", txhash)
                        recvTxHash = txhash ;
                        recvError = false ;
                    }

                    resole("") ;
                }
            )
        }) ;
    })() ;
    
    if (recvError) {
        // update tx info
        let updateData = {
            'status': Models.egtcollect.STATUS_DROP ,
            'err_info': ""+recvError
        } ;
        await Models.egtcollect.updateById(updateData, collectInfo.id) ;

        return false;
    }else{
        // update tx info
        let updateData = {
            'status': Models.egtcollect.STATUS_PENDING ,
            'err_info': "",
            'tx_hash': recvTxHash ,
            'collect_need': tokenBalance,
            'gas_limit': gasLimit,
            'gas_price': gasPrice
        } ;
        await Models.egtcollect.updateById(updateData, collectInfo.id) ;
    }

    // 更新用户状态
    await Models.users.updateById(addrinfo.id, {
        status: Models.users.STATUS_COLLECTING
    }) ;

    txEventAdd(recvTxHash, "collectToken", {
        cid:cid
    }) ;

    return true;
}

function txEventAdd(hash, event, params){
    let eventContent = {
        hash:hash,
        event:event,
        params:params
    } ;
    SubHeader.addTx(hash, eventContent) ;
    Models.tx.addTx(hash, JSON.stringify(eventContent)) ;
}

// {hash:xxx,event:xxx,[params:{...}]}
async function txEventCallback(eventContent, txEty){
    var hash = eventContent.hash;
    let rResult = await (async ()=>{
        return new Promise(async function (resole, reject) {
            //return resole(txhash);
            web3.eth.getTransactionReceipt(hash, function(_receiptErrMsg, _receiptData){
                if (_receiptErrMsg) {
                    process.env.addEthGas = 0 ; // 解锁
                    Utils.log.error(`txEventCallback getTransactionReceipt error: ${_receiptErrMsg.message}; hash: ${hash}`) ;
                    // Models.egtcollect.setErrById(cid, _receiptErrMsg.message) ;
                    return resole({succ:false, err:_receiptErrMsg.message, receipt:null});
                }

                if(!_receiptData){
                    Utils.log.error(`txEventCallback getTransactionReceipt error: receipt data null; hash: ${hash}`) ;
                    return resole({succ:false, err:"receipt data null", receipt:null});
                }

                if(!web3.toDecimal(_receiptData.status)){
                    // 0x0
                    Utils.log.error(`txEventCallback getTransactionReceipt error: status 0x0; hash: ${hash}`) ;
                    return resole({succ:false, err:"status 0x0", receipt:null});
                }else{
                    // 0x1
                    return resole({succ:true, err:"", receipt:_receiptData});
                }
            })
        })
    })() ;

    let now = (new Date()).getTime();

    // 更新 tx 
    let saveData = {
        block_num:txEty.blockNumber,
        gas:txEty.gas,
        gas_used: rResult.succ?rResult.receipt.gasUsed:0,
        gas_price:0, //txEty.gas_price.toNumber()
        value:0,//txEty.value.toNumber()
        addr_from:txEty.from,
        addr_to:txEty.to,
        status: rResult.succ?Models.tx.STATUS_SUCCESS:Models.tx.STATUS_FAILED ,
        err_info: rResult.succ?"":rResult.err ,
        updated_at: now
    }

    if(txEty.gas_price){
        saveData.gas_price = txEty.gas_price.toNumber() ;
    }
    if(txEty.value) {
        saveData.value = txEty.value.toNumber() ;
    }

    Models.tx.updateByHash(hash, saveData) ;

    switch (eventContent.event) {
        case "collectToken":
            txcb_collectToken(rResult.succ, eventContent.params.cid, rResult.err, rResult.receipt) ;
            break;
        case "sendEthForCollectToken":
            if(rResult.succ){
                addTokenCollect(eventContent.params.cid, eventContent.params.contractAddr) ;
            }
            break;
        case "sendEthForBatchCollectToken":
            let pkIndex = eventContent.params.pkIndex
            let taskId = eventContent.params.taskId
            let succ = 1
            let errmsg = ""

            if(!rResult.succ){
                // 标记GasManager错误
                // 标记GashTX错误
                succ = 0
                errmsg = rResult.err
            }

            // 回调
            let url = `${Config.main.webUrl}/manager/resetpkstatus?pkIndex=${pkIndex}&taskId=${taskId}&succ=${succ}&errmsg=${errmsg}`;
            Utils.log.info(`sendEthForBatchCollectToken callback url ${url}`) ;
            let cbResult = await Utils.http.get(url) ;
            if(cbResult){
                Utils.log.info(`sendEthForBatchCollectToken ${url} callback done : ${cbResult}`) ;
            }else{
                Utils.log.info(`sendEthForBatchCollectToken ${url} callback failed`) ;
            }
            
            break;
        default :
            Utils.log.error(`${eventContent.event} not found`) ;
    }
}

async function txcb_collectToken(succ,cid,errmsg,_receiptData){

    Utils.log.info(`txcb_collectToken recv task : ${succ} ${cid} ${errmsg}`) ;

    let collectInfo = await Models.egtcollect.getById(cid) ;
    let addrinfo = await Models.users.getByAddress(collectInfo.address);
    let platformInfo = await Models.platform.getByAccount(collectInfo.platform) ;

    if(!succ){
        // 0x0
        Utils.log.error(`txcb_collectToken error: ${errmsg}`) ;
        
        // 更新状态
        let _updateData = {
            status: Models.egtcollect.STATUS_FAILED ,
            err_info: errmsg
        } ;
        Models.egtcollect.updateById(_updateData, cid) ;

        // 更新用户状态
        Models.users.updateById(collectInfo.uid, {
            status: Models.users.STATUS_NORMAL
        }) ;
    }else{
        // 0x1

        // 更新状态
        let _updateData = {};
        _updateData.status = Models.egtcollect.STATUS_SUCCESS ;
        _updateData.gas_used = _receiptData.gasUsed ;
        Models.egtcollect.updateById(_updateData, collectInfo.id) ;

        let tokenInfo = await Models.token.getBySymbol(collectInfo.symbol) ;
        
        // 更新用户 balance_collected 
        let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
        let balanceNow = await ethAgent.getERC20Balance(tokenInfo.contract_addr, collectInfo.address);
        Models.token.updateBalanceCollected('egt', collectInfo.address, collectInfo.collect_need, balanceNow);

        // 更新用户状态
        Models.users.updateById(addrinfo.id, {
            status: Models.users.STATUS_NORMAL 
        }) ;

        
    }
}

module.exports = {
    // addTx: addTx ,
    // addEthGas: addEthGas ,
    addTokenCollect: addTokenCollect ,
    collectETHCyc: collectETHCyc,
    collectTokenCyc: collectTokenCyc,
    recollectTokenCyc: recollectTokenCyc,
    collectETH:collectETH,
    txEventAdd:txEventAdd,
    txEventCallback:txEventCallback
};