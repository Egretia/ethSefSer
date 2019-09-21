// 这个事件管理包用来监听充值以太坊gas的任务，并使用多个ETH钱包给客户地址充值gas费用
const Web3 = require('web3');
const Utils = require("../utils")
const Models = require("../models")
const EventHelper = require("../events/event-helper");
const EthWallet = require("ethereumjs-wallet");
const EthereumTx = require('ethereumjs-tx');

class GasManager {
    
    constructor(){
        this.gasLimit = 21000; // gas limit 转账 21000 ，智能合约转账 60000
        this.gasPriceCache = 20000000000; // 20 Gwei 
        
        Utils.log.info("GasManager being to work ...");
        this.init();
    }

    async init(){

        this.web3inner = new Web3();
        this.web3inner.setProvider(new Web3.providers.HttpProvider(Config.main.ethnet));
        this.updateGasPrice()
        setInterval(()=>{
            this.updateGasPrice()
        }, 10000) ; // 每十秒更新 GasPrice

        let pkList = await Models.gasmanager.getList() ;
        this.ethAgent = new Utils.eth.Agent(Config.main.ethnet);

        if(!pkList){
            Utils.log.error("cannot found any address for gas incharge");
            return false ;
        }

        this.pks = [] ;
        for(let i in pkList) {
            let b = await this.ethAgent.getBalance(pkList[i].address)
            // console.log(b);
            if (b===false) {
                Utils.log.error(`query ETH balance for ${pkList[i].address} failed `);
                continue ;
            }
            this.pks.push({
                "id": pkList[i].id,
                "priKey": pkList[i].prikey,
                "address": pkList[i].address,
                "status": pkList[i].status,
                "balance": b ,
                "errmsg":"",
                "timmer":null,
            })
        }

        if (this.pks.length>0) {
            for(let i=0; i<this.pks.length; i++) {
                this.beginTask(i)
            }
        }else{
            Utils.log.error("no available key for GasManager");
        }
    }

    async flushPkStatus(address){
        for (let i in this.pks) {
            if(this.pks[i].address == address) {
                if(this.pks[i].status == Models.gasmanager.STATUS_ERROR){
                    this.pks[i].status = Models.gasmanager.STATUS_FREE;
                    // 标记GasManager完成
                    await Models.gasmanager.update(this.pks[i].id, Models.gasmanager.STATUS_FREE, "") ;
                    // 重启PKINDEX
                    this.beginTask(i)
                }else{
                    return `address ${address} not in ERROR-STATUS` ;
                }

                break;
            }
        }
        return ""
    }

    async flushPKBalance(){
        for (let i in this.pks) {
            let b = await this.ethAgent.getBalance(pkList[i].address)
            // console.log(b);
            if (b===false) {
                Utils.log.error(`query ETH balance for ${pkList[i].address} failed `);
                continue ;
            }
            this.pks[i].balance = b;
        }
    }

    getPkStatus(){
        let result = [] ;
        console.log(this.pks);
        for (let i in this.pks) {
            result.push({
                "id": this.pks[i].id,
                "address": this.pks[i].address,
                "status": this.pks[i].status,
                "balance": this.pks[i].balance ,
                "errmsg":this.pks[i].errmsg,
            })
        }
        return result ;
    }

    updateGasPrice(){
        // console.log("try to get gas price") ;
        try{
            let gasPrice = parseFloat(this.web3inner.eth.gasPrice)*2;
            this.gasPriceCache = gasPrice;
        }catch(e){
            Utils.log.error(`updateGasPrice ${e}`);
        }
    }

    async beginTask(pkIndex){
        Utils.log.info(`PrivateKey ${pkIndex} ready to work`) ;
        this.pks[pkIndex].timmer = setInterval(async ()=>{
            
            let valueWei = this.gasPriceCache*this.gasLimit ;
            let valueUnit = this.web3inner.fromWei(valueWei, "ether") ;
            valueUnit = parseFloat(valueUnit);
            let valueNeed = valueUnit*3 // 3倍，可以用3次
            //let pkObj = this.pks[pkIndex];

            
            
            if(this.pks[pkIndex].status==Models.gasmanager.STATUS_FREE && this.pks[pkIndex].balance>valueNeed+valueUnit){
                
                let task = await Models.gasmanager.getTask() ;
                if(task) {
                    clearInterval(this.pks[pkIndex].timmer) ;

                    // Lock this PK
                    this.pks[pkIndex].status = Models.gasmanager.STATUS_PENDING;
                    Utils.log.info(`PrivateKey ${this.pks[pkIndex].address} received task ${task.id}`) ;
                    let ethnum = this.web3inner.toWei(valueNeed, "ether");
                    ethnum = parseInt(ethnum);
                    let txResult = await this.rechargeForCollect(this.pks[pkIndex].priKey, task.to_address, ethnum);
                    console.log("rechargeForCollect TX Result : ", txResult) ;
                    if(txResult.err) {
                        console.log("rechargeForCollect TX Result err: ", txResult) ;
                        this.pks[pkIndex].status = Models.gasmanager.STATUS_ERROR ;
                        this.pks[pkIndex].errmsg = txResult.err ;
                        Models.gasmanager.update(this.pks[pkIndex].id, Models.gasmanager.STATUS_ERROR, txResult.err) ;
                        Models.gasmanager.updateTask(task.id, "", 0, "", Models.gasmanager.TX_STATUS_WAITING)
                        
                    }else{
                        console.log("rechargeForCollect TX Result succ: ", txResult) ;
                        Models.gasmanager.update(this.pks[pkIndex].id, Models.gasmanager.STATUS_PENDING, "") ;
                        Models.gasmanager.updateTask(task.id, this.pks[pkIndex].address, ethnum, txResult.hash, Models.gasmanager.TX_STATUS_PENDING)
                        // 提交事务监控到 Subscriber
                        EventHelper.txEventAdd(txResult.hash, "sendEthForBatchCollectToken", {
                            pkIndex:pkIndex,
                            taskId:task.id
                        }) ;
                    }

                    
                }
            }            
        }, 3000) ; // 3 sec
    } 

    async rechargeForCollect(prikey, toAddr, ethnum) {

        return new Promise(async (resole, reject) => {
            var privateKey = Buffer.from(prikey, 'hex')
            var priInst = EthWallet.fromPrivateKey(privateKey);
            var fromAddr = "0x" + priInst.getAddress().toString("hex")

            let stInfo = {}
            stInfo.nonce = this.web3inner.eth.getTransactionCount(fromAddr);
            stInfo.from = fromAddr;
            stInfo.to = toAddr;
            stInfo.value = this.web3inner.toHex(ethnum);
            stInfo.gas = this.web3inner.toHex(this.gasLimit);
            stInfo.gasPrice = this.web3inner.toHex(this.gasPriceCache);
            
            const tx = new EthereumTx(stInfo)
            
            tx.sign(privateKey)
            const serializedTx = tx.serialize()

            var txstr = serializedTx.toString("hex")
            if (txstr.substr(0,2)!='0x'){
                txstr = '0x'+txstr ;
            }

            this.web3inner.eth.sendRawTransaction(txstr, function(err, txhash) {
                if (err) {
                    Utils.log.error("eventGas - send ETH failed "+err.message, err)
                    resole({
                        hash: "" ,
                        err: err.message
                    }) ;
                } else {
                    Utils.log.info("eventGas - send ETH done "+txhash)
                    resole({
                        hash: txhash ,
                        err: ""
                    }) ;
                } 
            });
        })
    }

    async resetPkStatus(pkIndex, taskId, succ, errmsg){
        // 
        //let pkObj = this.pks[pkIndex];
        if (this.pks[pkIndex]==undefined){

            return `pkindex ${pkIndex} not found` ;
        }

        if(succ) {

            // 标记GashTX完成
            Models.gasmanager.updateTaskStatus(taskId, Models.gasmanager.TX_STATUS_SUCCESS, "");

            let b = await this.ethAgent.getBalance(this.pks[pkIndex].address)
            if (b===false) {
                let emsg = `query ETH balance for ${this.pks[pkIndex].address} failed `;
                Utils.log.error(emsg);
                Models.gasmanager.update(this.pks[pkIndex].id, Models.gasmanager.STATUS_ERROR, emsg) ;
            }else{
                this.pks[pkIndex].balance = b;
                this.pks[pkIndex].status = Models.gasmanager.STATUS_FREE ;
                // 标记GasManager完成
                await Models.gasmanager.update(this.pks[pkIndex].id, Models.gasmanager.STATUS_FREE, "") ;
                // 重启PKINDEX
                this.beginTask(pkIndex)
            }
            
        }else{
            // 标记错误
            Models.gasmanager.updateTaskStatus(taskId, Models.gasmanager.TX_STATUS_FAILED, errmsg);
            Models.gasmanager.update(this.pks[pkIndex].id, Models.gasmanager.STATUS_ERROR, errmsg) ;
        }

        return ""
    }
}

module.exports = GasManager