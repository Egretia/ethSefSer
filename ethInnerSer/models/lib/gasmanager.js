const Query = require("./query") ;
const Mysql = require("mysql") ;
const Utils = require("../../utils") ;

//1 已提交，2 提交失败，3 成功，4 失败
var GasManager = {
    STATUS_FREE : 0 ,
    STATUS_PENDING: 1 ,
    STATUS_ERROR: 2 ,
    
    TX_STATUS_WAITING : 1 ,
    TX_STATUS_PENDING : 2 ,
    TX_STATUS_SUCCESS : 3 ,
    TX_STATUS_FAILED : 4 ,
} ;

GasManager.getList = async ()=>{
    let result = await Query.sql_select("select * from eth_gasmanager")
    if(result && result.length>0){
        return result ;
    }else{
        return false;
    }
}

GasManager.update = async (id, status, errmsg)=>{
    let now = (new Date()).getTime();
    let sql = "update eth_gasmanager set status="+status+",errmsg='"+errmsg+"',updated_at="+now+" where id="+id ;
    let r = await Query.sql_update(sql) ;
    return r;
}

GasManager.updateTaskStatus = async (id,status,errmsg)=>{
    let now = (new Date()).getTime();
    let sql = `update eth_gastx set errmsg='${errmsg}',status=${status},updated_at=${now} where id=${id}` ;
    let r = await Query.sql_update(sql) ;
    return r;
}

GasManager.updateTask = async (id,worker_address,value,tx_hash,status)=>{
    let now = (new Date()).getTime();
    let sql = `update eth_gastx set worker_address='${worker_address}',value=${value},tx_hash='${tx_hash}',status=${status},updated_at=${now} where id=${id}` ;
    console.log(sql) ;
    let r = await Query.sql_update(sql) ;
    return r;
}

GasManager.setTask = async (toAddress)=>{
    let now = (new Date()).getTime();
    // 插入一条打币事务
    let insertData = {
        worker_address:'' ,
        to_address:toAddress,
        value:0,
        tx_hash:'',
        status:GasManager.TX_STATUS_WAITING,
        created_at:now,
        updated_at:0,
        errmsg:''
    } ;

    let ok = await Query.sql_insert_ex("eth_gastx", insertData) ;
    return ok;
}

GasManager.getTask = async ()=>{
    // 获取一个需要打币的事务
    let now = (new Date()).getTime();
    let conn = await Query.atom_getconn() ;
    if (!conn){
        conn.release();
        Utils.log.error(`GasManager.getTask 获取SQL原子连接失败`) ;
        return false ;
    }

    if(!await Query.atom_begin(conn)) {
        conn.release();
        Utils.log.error(`GasManager.getTask 开始事务失败`) ;
        return false ;
    }

    let ret = false; 

    try{
        let task = await Query.atom_select("select * from eth_gastx where status="+GasManager.TX_STATUS_WAITING+" limit 1 FOR UPDATE", conn) ;
        if(!task || task.length<=0) {
            ret = false;
            throw new Error("task not found");
        }

        task = task[0];

        let isok = await Query.atom_update("update eth_gastx set status="+GasManager.TX_STATUS_PENDING+",updated_at="+now+" where id="+task.id, conn) ;
        if(!isok) {
            Utils.log.error(`GasManager.getTask 更新事务状态到pending失败`) ;
            throw new Error("update status of TX to PENDING failed");
        }

        await Query.atom_commit(conn) ;
        ret = task ;
    }catch(e){
        if(e.message!="task not found"){
            Utils.log.error(e.message) ;
        }
        
        await Query.atom_rollback(conn) ;
        ret = false ;
    }
    conn.release();

    return ret ;  
}

module.exports = GasManager