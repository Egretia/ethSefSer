const EventEmitter = require('events').EventEmitter ;
const Web3 = require('web3');
const HookedWeb3Provider = require("../utils/hooked-web3-provider");
const lightwallet = require('../lightwallet');
const Config = require('../config');
const Http = require('http');
const Models = require("../models");
const Utils = require("../utils") ;


lightwallet.keystore.prototype.passwordProvider = function (callback) {
    callback(null, Config.main.walletPwd) ;
}; // 密码提供者

var Event = new EventEmitter() ;
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(Config.main.ethnet));

Event.on('add-tx', function(inputData){
    
    console.log("recive withdraw event input data ", inputData) ;

    let _timmer = null ;

    _timmer = setInterval(function(){

        web3.eth.getTransaction(inputData.recvTxHash, function(_transactionErrMsg, _transactionData){
            if (_transactionErrMsg) {
                console.error("withdraw event getTransaction error: ", inputData.txId, _transactionErrMsg) ;
                clearInterval(_timmer) ;
                _timmer = null ;

                let _updateData = {
                    status: Models.withdraw.STATUS_FAILED,
                    err_info: _transactionErrMsg.message
                } ;
                Models.withdraw.updateById(_updateData, inputData.txId) ;
                
                // 回调
                Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&third_id="+inputData.txId+"&status_flag=failed&err_info="+_transactionErrMsg.message, (res) => {
                    console.log("withdraw event : event callback done http code : ", res.statusCode) ;
                }).on('error', (e) => {
                    console.error(`withdraw event callback err: ${e.message}`);
                });

                return false;
            }

            if (_transactionData && _transactionData.blockNumber) {
                

                // 矿工已经完成，请求票据
                web3.eth.getTransactionReceipt(inputData.recvTxHash, function(_receiptErrMsg, _receiptData){
                    if (_receiptErrMsg){
                        clearInterval(_timmer) ;
                        _timmer = null ;

                        // 出错了，直接回调错误
                        let _updateData = {
                            transaction: JSON.stringify(_transactionData) ,
                            status: Models.withdraw.STATUS_FAILED,
                            err_info: _receiptErrMsg.message
                        } ;
                        Models.withdraw.updateById(_updateData, inputData.txId) ;

                        // 回调
                        Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&third_id="+inputData.txId+"&status_flag=failed&err_info="+_receiptErrMsg.message, (res) => {
                            console.log("withdraw event callback done http code : ", res.statusCode) ;
                        }).on('error', (e) => {
                            console.error(`withdraw event callback err: ${e.message}`);
                        });

                        return false;
                    }else{
                        if (!_receiptData){
                            console.log("withdraw event receipt data is null , continue ...")
                            return true;
                        }
                        
                        clearInterval(_timmer) ;
                        _timmer = null ;

                        let _updateData = {
                            transaction: JSON.stringify(_transactionData) 
                        } ;

                        if(!web3.toDecimal(_receiptData.status)){
                            console.error("withdraw event getTransactionReceipt error: status 0x0") ;
                            _updateData.status = Models.withdraw.STATUS_FAILED ;
                            _updateData.err_info = "receip status was false, maybe the transaction was out of gas";

                            // 回调
                            Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&third_id="+inputData.txId+"&status_flag=failed&err_info="+_updateData.err_info, (res) => {
                                console.log("withdraw event callback done http code : ", res.statusCode) ;
                            }).on('error', (e) => {
                                console.error(`withdraw event callback err: ${e.message}`);
                            });
                        }else{
                            // 0x1
                            console.log("withdraw event success .") ;
                            _updateData.status = Models.withdraw.STATUS_SUCCESS ;

                            // 回调
                            Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&third_id="+inputData.txId+"&status_flag=success", (res) => {
                                console.log("tx event callback done http code : ", res.statusCode) ;
                            }).on('error', (e) => {
                                console.error(`tx event callback err: ${e.message}`);
                            });
                        }

                        Models.withdraw.updateById(_updateData, inputData.txId) ;
                        return true;
                    }

                }) ;
            }

        })

    }, 10000) ; // 每 10 秒请求

	console.log('end');
}) ;

Event.on('add-egt-collect', function(inputData){
    
    console.log("recive collect event input data ", inputData) ;

    let _timmer = null ;

    _timmer = setInterval(function(){

        web3.eth.getTransaction(inputData.recvTxHash, function(_transactionErrMsg, _transactionData){
            if (_transactionErrMsg) {
                console.error("collect event getTransaction error: ", inputData.applyId, _transactionErrMsg) ;
                clearInterval(_timmer) ;
                _timmer = null ;

                Models.users.updateById(inputData.uid, {
                    status: Models.users.STATUS_NORMAL
                }) ;

                Models.egtcollect.setErrByApplyId(inputData.applyId, 
                        _transactionErrMsg.message) ;
                
                // 回调
                Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+_transactionErrMsg.message, (res) => {
                    console.log("collect event callback done http code : ", res.statusCode) ;
                }).on('error', (e) => {
                    console.error(`collect event callback err: ${e.message}`);
                });

                return false;
            }

            if (_transactionData && _transactionData.blockNumber) {
                
                // 矿工已经完成，请求票据
                web3.eth.getTransactionReceipt(inputData.recvTxHash, async function(_receiptErrMsg, _receiptData){
                    if (_receiptErrMsg){
                        clearInterval(_timmer) ;
                        _timmer = null ;

                        // 更新状态
                        let _updateData = {
                            status: Models.egtcollect.STATUS_FAILED ,
                            err_info: _receiptErrMsg.message
                        } ;
                        Models.egtcollect.updateById(_updateData, inputData.id) ;
                        // 更新用户状态
                        Models.users.updateById(inputData.uid, {
                            status: Models.users.STATUS_NORMAL
                        }) ;
                        // 回调
                        Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+_updateData.err_info, (res) => {
                            console.log("collect event callback done http code : ", res.statusCode) ;
                        }).on('error', (e) => {
                            console.error(`collect event callback err: ${e.message}`);
                        });
                    }else{
                        if(!_receiptData){
                            console.log("collect event receipt data is null , continue ...")
                            return true;
                        }
                        console.warn("collect event getTransactionReceipt data: ", _receiptData) ;

                        clearInterval(_timmer) ;
                        _timmer = null ;
                        
                        if(!web3.toDecimal(_receiptData.status)){
                            // 0x0
                            console.error("collect event getTransactionReceipt error: status 0x0") ;
                            
                            // 更新状态
                            let _updateData = {
                                status: Models.egtcollect.STATUS_FAILED ,
                                err_info: "receip status was false, maybe the transaction was out of gas"
                            } ;
                            Models.egtcollect.updateById(_updateData, inputData.id) ;
                            // 更新用户状态
                            Models.users.updateById(inputData.uid, {
                                status: Models.users.STATUS_NORMAL
                            }) ;
                            // 回调
                            Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+_updateData.err_info, (res) => {
                                console.log("collect event callback done http code : ", res.statusCode) ;
                            }).on('error', (e) => {
                                console.error(`collect event callback err: ${e.message}`);
                            });
                        }else{
                            // 0x1

                            // 更新状态
                            let _updateData = {};
                            _updateData.status = Models.egtcollect.STATUS_SUCCESS ;
                            _updateData.gas_used = _receiptData.gasUsed ;
                            Models.egtcollect.updateById(_updateData, inputData.id) ;
                            
                            // 更新用户 balance_collected 
                            let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
                            let balanceNow = await ethAgent.getERC20Balance(Config.main.tokenAddr, inputData.addr)
                            Models.token.updateBalanceCollected('egt', inputData.addr, inputData.collectedNum,balanceNow);

                            // 更新用户状态
                            Models.users.updateById(inputData.uid, {
                                status: Models.users.STATUS_NORMAL 
                            }) ;

                            // 回调
                            Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=success", (res) => {
                                console.log("collect event callback done http code : ", res.statusCode) ;
                            }).on('error', (e) => {
                                console.error(`collect event callback err: ${e.message}`);
                            });
                        }

                        return true;
                    }
                    
                }) ;
            }

        })

    }, 10000) ; // 每 10 秒请求

	console.log('end');
}) ;

// 给需要收币的地址充eth gas 费用
Event.on('add-eth-gas', function(inputData){
    
    console.log("recive add-eth-gas event input data ", inputData) ;

    let _timmer = null ;

    _timmer = setInterval(function(){

        web3.eth.getTransaction(inputData.recvTxHash, function(_transactionErrMsg, _transactionData){
            if (_transactionErrMsg) {
                console.error("add-eth-gas getTransaction error: ", inputData.applyId, _transactionErrMsg) ;
                clearInterval(_timmer) ;
                _timmer = null ;
                process.env.addEthGas = 0 ; // 解锁

                Models.egtcollect.setErrByApplyId(inputData.applyId, 
                        _transactionErrMsg.message) ;
                
                // 回调
                Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+_transactionErrMsg.message, (res) => {
                    console.log("add-eth-gas event callback done http code : ", res.statusCode) ;
                }).on('error', (e) => {
                    console.error(`add-eth-gas event callback err: ${e.message}`);
                });

                return false;
            }

            if (_transactionData && _transactionData.blockNumber) {
                

                // 矿工已经完成，请求票据
                web3.eth.getTransactionReceipt(inputData.recvTxHash, function(_receiptErrMsg, _receiptData){
                    
                    if (_receiptErrMsg) {
                        clearInterval(_timmer) ;
                        _timmer = null ;
                        process.env.addEthGas = 0 ; // 解锁

                        console.error("add-eth-gas getTransactionReceipt error: ", inputData.applyId, _receiptErrMsg, _receiptData) ;
                        
                        Models.egtcollect.setErrByApplyId(inputData.applyId, 
                            _receiptErrMsg.message) ;
                    
                        // 回调
                        Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+_receiptErrMsg.message, (res) => {
                            console.log("add-eth-gas event callback done http code : ", res.statusCode) ;
                        }).on('error', (e) => {
                            console.error(`add-eth-gas event callback err: ${e.message}`);
                        });
                        return false;
                    }else{
                        if(!_receiptData){
                            console.log("add-eth-gas event receipt data is null , continue ...")
                            return true;
                        }
                        console.warn("add-eth-gas event getTransactionReceipt data: ", _receiptData) ;

                        clearInterval(_timmer) ;
                        _timmer = null ;
                        process.env.addEthGas = 0 ; // 解锁
                        
                        if(!web3.toDecimal(_receiptData.status)){
                            // 0x0
                            console.error("collect event getTransactionReceipt error: status 0x0") ;
                            let errinfo = "receip status was false, maybe the transaction was out of gas";
                            Models.egtcollect.setErrByApplyId(inputData.applyId, 
                                errinfo) ;
                        
                            // 回调
                            Http.get(inputData.callbackUrl+"?p_key="+inputData.pKey+"&apply_id="+inputData.applyId+"&status_flag=failed&err_info="+errinfo, (res) => {
                                console.log("add-eth-gas event callback done http code : ", res.statusCode) ;
                            }).on('error', (e) => {
                                console.error(`add-eth-gas event callback err: ${e.message}`);
                            });
                        }else{
                            // 0x1
                            // egt 汇总
                            addEgtCollect(inputData.applyId) ;
                        }

                        return true;
                    }
                    
                }) ;
            }

        })

    }, 10000) ; // 每 10 秒请求

	console.log('end');
}) ;

function addTx(data) {
    Event.emit('add-tx', data);
}

function addEthGas(data) {
    Event.emit('add-eth-gas', data);
}

async function addEgtCollect(applyId) {
    let collectInfo = await Models.egtcollect.getByApplyId(applyId) ;
    if (!collectInfo) {
        return false;
    }
    let addrinfo = await Models.users.getByAddress(collectInfo.address);
    let walletinfo = await Models.wallet.getById(addrinfo.mid);
    let platformInfo = await Models.platform.getByAccount(collectInfo.platform) ;
    
    var buffer = new Buffer(walletinfo.ks);
    var keyStore = lightwallet.keystore.deserialize(buffer.toString());
    
    // init web3
    let web3inner = new Web3();
    
    let web3innerProvider = new HookedWeb3Provider({
        host: Config.main.ethnet,
        transaction_signer: keyStore
    });
    web3inner.setProvider(web3innerProvider);
    
    fromAddr = collectInfo.address ;
    toAddr = Config.main.collectAddr ;

    var nonce = web3inner.eth.getTransactionCount(fromAddr);
    // egtVal = web3.toWei(egt_balance, "ether");
    egtVal = web3inner.toHex(web3inner.toWei(collectInfo.collect_need, "ether"));
    
    // 传递给 lightwallet.txutils.valueTx 的值，需要转换成16进制，因为 web3的 web3.eth.sendRawTransaction 中需要的就是 16进制数据
    var transactionObject = {
        nonce: web3inner.toHex(nonce) ,
        from: fromAddr,
        value: "0x0",
        gas: web3inner.toHex(parseFloat(collectInfo.gas_limit)),
        gasPrice: web3inner.toHex(parseFloat(collectInfo.gas_price)),
    };

    let abi = Utils.erc20abi.abi ;
    var calcContract = web3inner.eth.contract(abi);
    var contractInstance = calcContract.at(Config.main.tokenAddr);

    var recvTxHash = false ;    
    var recvError = false ;

    await (async ()=>{
        return new Promise(function (resole, reject) {
            // console.log("aaa",toAddr, egtVal, transactionObject);
            contractInstance.transfer.sendTransaction(toAddr, egtVal, transactionObject,
                function (err, txhash) {
                    if (err) {
                        console.log("addEgtCollect send ERC20 Token failed ", err)
                        recvTxHash = false ;
                        recvError = err.message ;
                    } else {
                        console.log("addEgtCollect send ERC20 token done ", txhash)
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
            'tx_hash': recvTxHash 
        } ;
        await Models.egtcollect.updateById(updateData, collectInfo.id) ;
    }

    // 更新用户状态
    await Models.users.updateById(addrinfo.id, {
        status: Models.users.STATUS_COLLECTING
    }) ;
    
    Event.emit('add-egt-collect', {
        id: collectInfo.id ,
        uid: addrinfo.id,
        addr: addrinfo.address,
        recvTxHash: recvTxHash,
        applyId: collectInfo.apply_id,
        pKey: platformInfo.p_key,
        callbackUrl: Config.main.collectCallback,
        collectedNum: collectInfo.collect_need
    });

    return true;
}

module.exports = {
    addTx: addTx ,
    addEthGas: addEthGas ,
    addEgtCollect: addEgtCollect
};