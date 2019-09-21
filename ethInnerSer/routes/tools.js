var express = require('express');
var router = express.Router();
const Web3 = require('web3');
const EthWallet = require("ethereumjs-wallet")
const lightwallet = require('../lightwallet');
const Utils = require("../utils");
const HookedWeb3Provider = require("../utils/hooked-web3-provider");

lightwallet.keystore.prototype.passwordProvider = function (callback) {
    callback(null, Config.main.walletPwd) ;
}; // 密码提供者

const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.log(err);
        next(err);
    });
};

// 该路由使用的中间件
router.use(asyncMiddleware(async (req, res, next) => {
    next();
}));

router.all('/testbatchcollect', async function(req, res, next){
    
    let addrs = [] ;
    
    let reqdata = {
        "address": [
            "0xa02b1d8023a57869e292263cb87e3f0c71139087"
        ] , 
        "token_type": "egt" ,
        "page_numb": 1+"" ,
        "batch_id": "test001" ,
    }
    
    reqdata = JSON.stringify(reqdata) ;
    let postresp = await Utils.http.post("http://192.168.31.57:3024/erc20pooling", reqdata) ;

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
});

router.get('/testapprove', async function (req, res, next) {
    let fromAddr = "0xa02b1d8023a57869e292263cb87e3f0c71139087"
    
    let addrinfo = await Models.users.getByAddress(fromAddr);
    let walletinfo = await Models.wallet.getById(addrinfo.mid);
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
    gasPrice = parseFloat(web3inner.eth.gasPrice)*1.5;

    // 传递给 lightwallet.txutils.valueTx 的值，需要转换成16进制，因为 web3的 web3.eth.sendRawTransaction 中需要的就是 16进制数据
    var transactionObject = {
        //nonce: web3inner.toHex(nonce) ,
        from: fromAddr,
        value: "0x0",
        gas: web3inner.toHex(gasLimit),
        gasPrice: web3inner.toHex(gasPrice),
    };
    
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet, Utils.eth.KST_LW, {
        ksSer: walletinfo.ks,
        password: Config.main.walletPwd
    });

    let w = web3inner.toWei("1000000", "ether")

    let result = await ethAgent.approve("0xBDb3e0f8633B40D0C5c130862A2739f6dA06E46a", transactionObject, "0x8a7b806fd7a7f0f28df19cd65cc4ae8d3f42aa23", w) ;
    console.log(result);
    res.send(Utils.app.ajax_success({"msg":"It works."}));
});

// 可用性测试
router.get('/test', async function (req, res, next) {

    
    res.send(Utils.app.ajax_success({"msg":"It works."}));
});

// 生成1个秘钥对
router.get('/createkeypair', async function (req, res, next) {

    let wallet = EthWallet.generate()

    let keyPair = {
        "priKey": wallet.getPrivateKey().toString('hex') ,
        "address": wallet.getAddress().toString('hex')
    }

    res.send(Utils.app.ajax_success(keyPair));
})

router.get("/createwallet", async function(req, res, next){
    let walletObj = await Utils.eth.createWallet("") ;
    let addresses = await Utils.eth.newAddresses(walletObj.ks, "", 1);
    res.send(Utils.app.ajax_success({wallet:walletObj, addresses:addresses}));
})

// 导出私钥
router.get('/exportprikey', async function (req, res, next) {
    
    var mnemonic = Utils.app.safeGetInput(req, "mnemonic", "") ;
    var address = Utils.app.safeGetInput(req, "address", "") ;

    if (!mnemonic || !address) {
        return res.send(Utils.app.ajax_failed("param null"));
    }

    mnemonic = decodeURI(mnemonic);
    address = address.toLowerCase();
    var num = 100;  // 助记词数量

    var ksResult = await (()=>{
        return new Promise(function (resole, reject) {
            //生成助记词和地址
            lightwallet.keystore.createVault({
                password: "",
                seedPhrase: mnemonic,
                //random salt 
                hdPathString: Utils.eth.hdPathString
            }, function (err, ks) {
                if (err) {
                    LogUtil.error("Create ethereum wallet failed. error: "+err.message);
                    return resole(false);
                }

                ks.keyFromPassword("", function (err, pwDerivedKey) {
                    if (err) {
                        LogUtil.error("New address failed : "+err.message);
                        return resole(false);
                    }
                    ks.generateNewAddress(pwDerivedKey, num);
                    // let addresses = ks.getAddresses();

                    let pk = ks.exportPrivateKey(address, pwDerivedKey)
                    // console.log(pk) ;
                    
                    return resole({
                        "priKey": pk,
                        "address": address
                    });
                });

                
            });
        });
    })() ;

    if(!ksResult) {
        return res.send(Utils.app.ajax_failed("create wallet failed"));
    }

    res.send(Utils.app.ajax_success(ksResult));
});

module.exports = router;