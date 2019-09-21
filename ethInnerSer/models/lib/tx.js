var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Tx = {
    STATUS_PENDDING: 0,
    STATUS_SUCCESS: 1,
    STATUS_FAILED: 2,
}

Tx.hasPendding = async (addr)=>{
    let sql = "select * from eth_tx where addr_from="+Mysql.escape(addr)+" and status="+Tx.STATUS_PENDDING+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
} ;

Tx.updateByHash = async (hash, data) =>{
    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }
    let sql = "update eth_tx set "+fields.join(",")+" where hash="+Mysql.escape(hash);
    let result = await Query.sql_update(sql) ;
    return result ;
}

Tx.addTx = async (hash, event_content)=>{
    let now = (new Date()).getTime();
    let data = {
        hash:hash,
        block_num:0,
        gas:"0",
        gas_used:"0",
        gas_price:"0",
        value:"0",
        addr_from:"",
        addr_to:"",
        event_content:event_content,
        status:Tx.STATUS_PENDDING ,
        err_info:"",
        created_at:now,
        updated_at:0
    } ;

    let id = await Query.sql_insert_ex("eth_tx", data) ;
    return id;
}

module.exports = Tx