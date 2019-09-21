var Log4js = require("log4js");

console.log("init log4js ...")
// config log4js http://shenyujie.cc/2018/05/25/log4js-basic/
Log4js.configure({
    appenders: { cheese: { 
        type: 'dateFile', 
        filename: Config.main.logPath+'/ethInnerSer', 
        pattern: "yyyy-MM-dd.log", 
        alwaysIncludePattern: true 
    } },
    categories: { default: { appenders: ['cheese'], level: 'debug' } }
});
var applog = Log4js.getLogger('cheese');

Log = {} ;

Log.writelog = (level, ...msgs)=>{
    let sid = parseInt(Math.random()*10000000) 
    for(let i in msgs) {
        let msg = msgs[i]
        if (typeof(msg)!='string'){
            try{
                msg = JSON.stringify(msg) ;
                switch(level) {
                    case "error": applog.error(`[sid = ${sid}] ${msg}`); break;
                    case "info": applog.info(`[sid = ${sid}] ${msg}`); break;
                    default: applog.debug(`[sid = ${sid}] ${msg}`); break;
                }
            }catch(e){
                console.error(e) ;
            }
        }
    }
}

Log.info = (...msgs)=>{
    Log.writelog("info", msgs);
}

Log.debug = (...msgs)=>{
    Log.writelog("debug", msgs);
}

Log.error = (...msgs)=>{
    Log.writelog("error", msgs);
}

module.exports = Log ;