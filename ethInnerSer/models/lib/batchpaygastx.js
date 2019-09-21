const Query = require("./query") ;
const Mysql=require("mysql") ;
const Utils=require("../../utils")

//1 已提交，2 提交失败，3 成功，4 失败
var BatchPayGasTx = {
} ;

BatchPayGasTx.save = async (contents,gas,pagetotal) => {
    let now = (new Date()).getTime();
    let data = {
        contents: contents,
        created_at: now,
        updated_at: 0,
        page: 1,
        ptotal: pagetotal,
        errinfo: "" ,
        gas: gas
    } ;

    let isok = await Query.sql_insert_ex("eth_batchpaygastx", data) ;
    return isok ;
}

BatchPayGasTx.getNewest = async () => {
    let info = await Query.sql_select("SELECT * FROM `eth_batchpaygastx` order by id desc limit 1") ;
    if(!info || info.length<=0){
        return false ;
    }
    return info[0] ;
}

BatchPayGasTx.getById = async (id) => {
    id = parseInt(id) 
    let info = await Query.sql_select("SELECT * FROM `eth_batchpaygastx` where id="+id) ;
    if(!info || info.length<=0){
        return false ;
    }
    return info[0] ;
}

BatchPayGasTx.update = async (id, page, errinfo) => {
    let now = (new Date()).getTime();
    try{
        id = parseInt(id)
        page = parseInt(page)
    }catch(e) {
        Utils.log.error("parse data failed "+e.message) ;
        return false ;
    }
    let sql = "update eth_batchpaygastx set page="+page+",errinfo="+Mysql.escape(errinfo)+",updated_at="+now+" where id="+id ;
    let ok = await Query.sql_update(sql) ;
    return ok ;
}

module.exports = BatchPayGasTx;