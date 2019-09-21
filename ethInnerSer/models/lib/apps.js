const Query = require("./query") ;
const Mysql=require("mysql") ;

//1 已提交，2 提交失败，3 成功，4 失败
var Apps = {
} ;

Apps.getbyaccount = async (account) => {
    let userInfo = await Query.sql_select("SELECT * FROM `eth_apps` where account="+Mysql.escape(account)) ;
    if(!userInfo || userInfo.length<=0){
        return false ;
    }
    return userInfo[0] ;
}

Apps.getall = async () => {
    let userInfo = await Query.sql_select("SELECT * FROM `eth_apps`") ;
    if(!userInfo || userInfo.length<=0){
        return [] ;
    }
    return userInfo ;
}

module.exports = Apps;