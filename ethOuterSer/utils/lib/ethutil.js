const Web3 = require('web3');
const lightwallet = require('../../lightwallet');

const Erc20Abi = require("./erc20abi")
const LogUtil = require("./log")
const AppUtil = require("./app")

var EthUtil = {
    KST_LW : "lightwallet" ,
    KST_NONE: "none",

    hdPathString: "m/44'/60'/0'/0"
} ;

function Agent (rpcHost, ksType="none", ksParams=null) {
    var web3 = new Web3() ;

    switch (ksType) {
    case EthUtil.KST_LW:
        // ksParams{ksSer:"lightwallet 对象序列化串", password:"密码"} 
        if (!ksParams) {
            throw new Error("Keystore param null, fail to init Agent.") ;
        }
        let ksObj = lightwallet.keystore.deserialize(ksParams.ksSer);
        ksObj.passwordProvider= function (callback) {
            callback(null, ksParams.password) ;
        }; // 密码提供者
        var web3Provider = new HookedWeb3Provider({
            host: rpcHost,
            transaction_signer: ksObj
        });
        web3.setProvider(web3Provider);
        break;
    default:
        // KST_NONE
        web3.setProvider(new Web3.providers.HttpProvider(rpcHost));
        break;
    }

    this.web3 = web3 ;
};

Agent.prototype = {
    getERC20Balance : function (tokenAddr, address) {
        var web3 = this.web3 ;

        return new Promise(function (resole, reject) {
            let calcContract = web3.eth.contract(Erc20Abi.abi);
            let contractInstance = calcContract.at(tokenAddr);
            contractInstance.balanceOf.call(address,
                function (err, value) {
                    if (err) {
                        LogUtil.error('Get ERC20 token error: ' + err.message);
                        return resole(false);
                    } else {
                        let egt_value = web3.fromWei(value.toNumber(), "ether");
                        return resole(egt_value);
                    }
                }
            )
        }) ;
    } ,
    getBalance : function (address) {
        var web3 = this.web3 ;

        return new Promise(function (resole, reject) {
            web3.eth.getBalance(address, function (err, result) {
                if (err == null) {
                    result = web3.fromWei(result, "ether");
                    return resole(parseFloat(result));
                } else {
                    LogUtil.error('Get ETH balance error: ' + err.message);
                    return resole(false);
                }
            });
        })
    } ,
};

EthUtil.Agent = Agent ;

EthUtil.createWallet = (password) => {
    return new Promise(function (resole, reject) {
        //生成助记词和地址
        var extraEntropy = AppUtil.createRandom(32);
        var mnemonic = lightwallet.keystore.generateRandomSeed(extraEntropy);
        lightwallet.keystore.createVault({
            password: password,
            seedPhrase: mnemonic,
            //random salt 
            hdPathString: EthUtil.hdPathString
        }, function (err, ks) {
            if (err) {
                LogUtil.error("Create ethereum wallet failed. error: "+err.message);
                return resole(false);
            }
            return resole({
                "ks": ks,
                "mnemonic": mnemonic
            });
        });
    });
};

EthUtil.newAddress = (ks, password) => {
    return new Promise(function (resole, reject) {
        ks.keyFromPassword(password, function (err, pwDerivedKey) {
            if (err) {
                LogUtil.error("New address failed : "+err.message);
                return resole(false);
            }
            ks.generateNewAddress(pwDerivedKey, 1);
            let addresses = ks.getAddresses();
            let address = addresses[0];
            return resole(address);
        });
    });
};

EthUtil.newAddresses = (ks, password, num) => {
    return new Promise(function (resole, reject) {
        ks.keyFromPassword(password, function (err, pwDerivedKey) {
            if (err) {
                LogUtil.error("New address failed : "+err.message);
                return resole(false);
            }
            ks.generateNewAddress(pwDerivedKey, num);
            let addresses = ks.getAddresses();
            
            return resole(addresses);
        });
    });
};

module.exports = EthUtil ;