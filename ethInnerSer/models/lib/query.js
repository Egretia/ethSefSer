const Config = require("../../config");
const Mysql = require("mysql");
const Utils = require("../../utils");

const mylog = Utils.log;

var myConf = {
	connectionLimit: 10,
	host: Config.db.host,
	user: Config.db.user,
	password: Config.db.password,
	database: Config.db.database,
	charset: Config.db.charset
};

var pool = Mysql.createPool(myConf);
console.log("create pool"); 

var mysqlquery = {} ;

/**********  mysql operate with atom  ********** */
mysqlquery.atom_rollback = function (conn) {

	return new Promise(function (resole, reject) {

		conn.rollback(function () {
			
			return resole(true); 
		});

	})
}

mysqlquery.atom_commit = function (conn) {

	return new Promise(function (resole, reject) {

		conn.commit(function () {
			
			return resole(true); 
		});

	})
}

mysqlquery.atom_begin = function (conn) {

	return new Promise(function (resole, reject) {

		conn.beginTransaction(async function (err) {
			if (err) {
				mylog.error("connection.beginTransaction error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			return resole(true);
		});

	})
}

mysqlquery.atom_select = function (sql, conn) {

	return new Promise(function (resole, reject) {

		conn.query(sql, function (err, rows, fields) {
			// connection.release();

			if (err) {
				mylog.error(err);
				mylog.error(sql);
				return resole(false);
			}

			return resole(rows);
		});

	})

}

mysqlquery.atom_insert_ex = async function (table, data, conn) {

	let dataFields = [] ;
	let dataValues = [] ;
	for(dk in data) {
		dataFields.push(dk) ;
		dataValues.push(Mysql.escape(data[dk])) ;
	}

	let sql = "insert into `"+table+"`(`"+dataFields.join("`,`")+"`) values("+dataValues.join(",")+")" ;
	let result = await mysqlquery.atom_insert(sql, conn) ;
	return result ;

}

mysqlquery.atom_insert = function (sql, conn) {

	return new Promise(function (resole, reject) {

		conn.query(sql, function (err, results, fields) {
			// connection.release();

			if (err) {
				mylog.error(err);
				mylog.error(sql);
				return resole(false);

			}

			return resole(results.insertId);
		});

	})

}

mysqlquery.atom_update = function (sql, conn) {
	return new Promise(function (resole, reject) {
		conn.query(sql, function (err, results, fields) {
			// connection.release();

			if (err) {
				mylog.error(err);
				mylog.error(sql);
				return resole(false);
			}

			return resole(true);
		});

	})

}

mysqlquery.atom_delete = function (sql, conn) {
	return new Promise(function (resole, reject) {
		conn.query(sql, function (err, results, fields) {
			// connection.release();

			if (err) {
				mylog.error(err);
				mylog.error(sql);
				return resole(false);
			}

			return resole(true);
		});
	})
}

mysqlquery.atom_getconn = function () {
	return new Promise(function (resole, reject) {

		pool.getConnection(function (err, connection) {
			if (err) {
				mylog.error("pool.getConnection error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			return resole(connection);
		})

	})
}

/********** normal mysql operate  ********** */

mysqlquery.sql_select = function (sql) {

	return new Promise(function (resole, reject) {

		pool.getConnection(function (err, connection) {
			if (err) {
				mylog.error("pool.getConnection error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			connection.query(sql, function (err, rows, fields) {
				connection.release();

				if (err) {
					mylog.error(err);
					mylog.error(sql);
					return resole(false);
				}

				return resole(rows);
			});
		})

	})

}

mysqlquery.sql_insert_ex = async function (table, data) {

	let dataFields = [] ;
	let dataValues = [] ;
	for(dk in data) {
		dataFields.push(dk) ;
		dataValues.push(Mysql.escape(data[dk])) ;
	}

	let sql = "insert into `"+table+"`(`"+dataFields.join("`,`")+"`) values("+dataValues.join(",")+")" ;
	let result = await mysqlquery.sql_insert(sql) ;
	return result ;

}

mysqlquery.sql_insert = function (sql) {

	return new Promise(function (resole, reject) {

		pool.getConnection(function (err, connection) {
			if (err) {
				mylog.error("pool.getConnection error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			connection.query(sql, function (err, results, fields) {
				connection.release();

				if (err) {
					mylog.error(err);
					mylog.error(sql);
					return resole(false);

				}

				return resole(results.insertId);
			});
		})

	})

}

mysqlquery.sql_update = function (sql) {
	return new Promise(function (resole, reject) {
		pool.getConnection(function (err, connection) {
			if (err) {
				mylog.error("pool.getConnection error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			connection.query(sql, function (err, results, fields) {
				connection.release();

				if (err) {
					mylog.error(err);
					mylog.error(sql);
					return resole(false);
				}

				return resole(true);
			});
		})

	})

}

mysqlquery.sql_delete = function (sql) {
	return new Promise(function (resole, reject) {
		pool.getConnection(function (err, connection) {
			if (err) {
				mylog.error("pool.getConnection error");
				mylog.error(err);
				connection.release();
				return resole(false);
			}

			connection.query(sql, function (err, results, fields) {
				connection.release();

				if (err) {
					mylog.error(err);
					mylog.error(sql);
					return resole(false);
				}

				return resole(true);
			});
		})


	})
}

mysqlquery.close = function () {
	console.log("close all connections");
	return new Promise(function (resole, reject) {
		pool.end(function (err) {
			// all connections in the pool have ended
			if (err) {
				mylog.error("pool.end error");
				mylog.error(err);
			}

			return resole(true);
		});
	})
	
}

module.exports = mysqlquery;