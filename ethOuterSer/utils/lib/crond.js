// const { URL } = require('url');
// const https = require('https');
// const Config = require("../../config") ;
// const HttpsProxyAgent = require('https-proxy-agent')
const fs = require('fs');

var Crond = {
    exchangeData: {
        eth_usdt: 448.5158,
        okb_usdt: 3.6947,
        okb_egt: 0.4,
        egt_usdt: 1.47788 // okb_usdt * okb_egt
    }
}

// function doGetExchange

Crond.updateExchangeData = () => {
    let path = Config.main.exchangeDataPath;
    fs.readFile(path, (err, data) => {
        if (err) {
            console.log("read exchange data file failed ", err);
        }else{
            let result = JSON.parse(data) ;
            // console.log("update exchange data done") ;
            Crond.exchangeData.eth_usdt = parseFloat(result.eth_usdt) ;
            Crond.exchangeData.okb_usdt = parseFloat(result.okb_usdt) ;
            Crond.exchangeData.okb_egt = parseFloat(result.okb_egt) ;
            Crond.exchangeData.egt_usdt = parseFloat(result.egt_usdt) ;
        }
        
    });
}

module.exports = Crond;