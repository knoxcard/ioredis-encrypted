'use strict';
const Redis = require('ioredis');
const util = require('./util');
const Crypto = require('node-crypt');

module.exports = function EncryptedRedis(key, algorithm) {
  return function(...args) {
    util.enforceNotEmpty(key, 'You must specify an encryption key');

    const crypto = new Crypto({
      key: key,
      algorithm: algorithm
    });

    const client = new Redis(...args);
    const encryptCommand = (methodName, item) => {
      const method = client[methodName].bind(client);
      client[methodName] = function(...args) {
        args[item] = crypto.encrypt(args[item]);
        method(...args);
      };
    };

    const decryptResult = (methodName) => {
      const method = client[methodName].bind(client);
      client[methodName] = function(...args) {
        let done = args.pop();
        method(...args, (err, result) => {
          /* jshint maxcomplexity: 6 */
          if(err) { return done(err); }
          if(util.isEmpty(result)) { return done(null, result); }
          if(result instanceof Object) {
            Object.keys(result).map(key => {
              result[key] = crypto.decrypt(result[key]);
            });
          } else {
            result = crypto.decrypt(result);
          }
          done(null, result);
        });
      };
    };

    encryptCommand('set', 1);
    decryptResult('get');

    encryptCommand('hset', 2);
    decryptResult('hget');

    decryptResult('hgetall');

    return client;
  };
};