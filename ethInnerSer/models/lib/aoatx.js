const Query = require("./query") ;
const Mysql=require("mysql") ;

//1 已提交，2 提交失败，3 成功，4 失败
var Aoatx = {
} ;

Aoatx.getBalance = async (uid, needToUpdate) => {
    if (needToUpdate) {
        let s_sql = "select sum(amount) as balance from eth_aoatx where uid="+uid ;
        let s_result = await Query.sql_select(s_sql) ;
        let balance = s_result[0].balance ;
        if(balance>0){
            if(! await Query.sql_update("update eth_accounts set aoa_balance='"+balance+"' where id="+uid)) {
                return false ;
            }
        }
        return balance ;
    }

    let userInfo = await Query.sql_select("select aoa_balance from eth_accounts where id="+uid) ;
    return userInfo[0].aoa_balance ;
}

Aoatx.txExists = async (txhash) => {
    let sql = "select id from eth_aoatx where txhash='"+txhash+"'" ;
    let result = await Query.sql_select(sql) ;
    if(result && result.length>0) {
        return true;
    }
    return false ;
}

Aoatx.add = async (data) => {
    data["created_at"] = (new Date()).getTime() ;
    let result = await Query.sql_insert_ex("eth_aoatx", data) ;
    return result ;
}

module.exports = Aoatx;