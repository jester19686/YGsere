'use strict';

module.exports.createCorsMiddleware = function createCorsMiddleware(allowOrigins) {
  const allow = (allowOrigins || '').split(',').map(s => s.trim()).filter(Boolean);
  const isProd = process.env.NODE_ENV === 'production';
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (isProd) {
      if (origin && allow.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      if (origin && (!allow.length || allow.includes(origin))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (!allow.length) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    }
    const reqHdrs = req.header('Access-Control-Request-Headers');
    const baseHdrs = 'Content-Type, Authorization';
    res.setHeader('Access-Control-Allow-Headers', reqHdrs ? `${baseHdrs}, ${reqHdrs}` : baseHdrs);
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
};



