Log = {} ;

Log.debug = (msg)=>{
    if (typeof(msg)!='string'){
        msg = JSON.stringify(msg) ;
    }

    console.log(msg) ;
}

Log.error = (msg)=>{
    if (typeof(msg)!='string'){
        msg = JSON.stringify(msg) ;
    }

    console.log(msg) ;
}

module.exports = Log ;