var MyArray = {};

MyArray.keys = (object)=>{
    let keyArr = [] ;
    for (key in object){
        keyArr.push(key) ;
    }

    return keyArr ;
}

MyArray.values = (object)=>{
    let valueArr = [] ;
    for (key in object){
        valueArr.push(object[key]) ;
    }

    return valueArr ;
}

module.exports = MyArray ;