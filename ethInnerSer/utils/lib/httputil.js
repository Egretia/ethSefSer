const UrlUtil = require("url");
const Https = require('https');
const Http = require('http');
const Log = require("./log");

function asyncGet(url,cb) {
    let h = Http;
    if(url.substring(0,5)=="https"){
        h = Https;
    }

    h.get(url, (res) => {
        const { statusCode } = res;

        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                `Status Code: ${statusCode}`);
            
        } 
        if (error) {
            
            Log.error(error.message);
            cb(error, null);
            return false;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            cb(null, rawData);
            return true;
        });
    }).on('error', (e) => {
        Log.error(e.message);
        cb(e, null);
        return false;
    });
}

function get(url) {
    return new Promise(function (resole, reject) {

        let h = Http;
        if(url.substring(0,5)=="https"){
            h = Https;
        }

        h.get(url, (res) => {
            const { statusCode } = res;
            
            let error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                    `Status Code: ${statusCode}`);
                
            } 
            
            if (error) {
                
                Log.error(`request ${url} failed ${error.message}`);
                return resole(false);
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                return resole(rawData);
                
            });
        }).on('error', (e) => {
            Log.error(`request ${url} failed ${e.message}`);
            return resole(false);
        });
    });
}

function post(url, reqdata) {
    
    return new Promise(function (resole, reject) {

        let h = Http;
        if(url.substring(0,5)=="https"){
            h = Https;
        }

        let parsedUrl = UrlUtil.parse(url) ;

        var options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'post',
            headers: {
            'Content-Type':'application/json',
            'Content-Length':reqdata.length
        }};

        var req = h.request(options, (res) => {
            const { statusCode } = res;
            
            let error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                    `Status Code: ${statusCode}`);
                
            } 
            
            if (error) {
                
                Log.error(`request ${url} failed ${error.message}`);
                return resole(false);
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                return resole(rawData);
                
            });
        }).on('error', (e) => {
            Log.error(`request ${url} failed ${e.message}`);
            return resole(false);
        });

        req.write(reqdata + "\n");
        req.end();
    });
}

module.exports = {
    get: get,
    asyncGet: asyncGet,
    post: post
};