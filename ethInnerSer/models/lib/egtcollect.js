const Query = require("./query") ;
const Mysql=require("mysql") ;
const Utils = require("../../utils") ;

//1 已提交，2 提交失败，3 成功，4 失败
var Collect = {
    STATUS_CREATE : 1 ,
    STATUS_PENDING: 2 ,
    STATUS_DROP : 3 ,
    STATUS_SUCCESS : 4 ,
    STATUS_FAILED : 5 
} ;

Collect.getErrItems = async (symbol) => {
    let result = await Query.sql_select("select * from eth_collect where symbol='"+symbol+"' and status="+Collect.STATUS_DROP)
    if(result && result.length>0){
        return result ;
    }else{
        return false;
    }
}

Collect.setErrById = async (cid, errmsg) => {
    let data = {
        updated_at: (new Date()).getTime(),
        err_info: errmsg ,
        status: Collect.STATUS_DROP
    }
    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }

    let sql = "update eth_collect set "+fields.join(",")+" where id="+cid ;
    let result = await Query.sql_update(sql) ;
    return result ;
}

Collect.updateById = async (data, id) =>{
    data["updated_at"] = (new Date()).getTime();

    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }

    let sql = "update eth_collect set "+fields.join(",")+" where id="+id+" limit 1" ;
    // Utils.log.debug(sql) ;

    let result = await Query.sql_update(sql) ;
    return result ;
}

Collect.getById = async (cid) =>{
    let result = await Query.sql_select("select * from eth_collect where id="+cid+" limit 1")
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}

Collect.isCollecting = async (address) => {
    let status = Collect.STATUS_CREATE+","+Collect.STATUS_PENDING;
    let sql = "select * from eth_collect where address='"+address+"' and status in("+status+") limit 1";
    // console.log("is collecting sql is ", sql)
    let result = await Query.sql_select(sql);
    if (result && result.length>0) {
        return true;
    }
    return false;
}

Collect.add = async (data) =>{
    data['created_at'] = (new Date()).getTime() 
    let result = await Query.sql_insert_ex("eth_collect", data) ;
    
    return result;

}

// 给需要聚合的地址充eth gas费用
Collect.recordEthGas = async (collectId,eth,txhash)=>{
    
    let data = {
        collect_id: collectId ,
        eth: eth ,
        txhash: txhash ,
        created_at: (new Date()).getTime() 
    }

    let result = await Query.sql_insert_ex("eth_ethgas", data) ;
    return result;
}


module.exports = Collect;