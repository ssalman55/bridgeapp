module.exports = (req, res, next) => {
  console.log('OWNER MIDDLEWARE DEBUG:', {
    user: req.user,
    envOwner: process.env.OWNER_EMAIL,
    path: req.path,
    method: req.method,
  });
  if (!req.user || req.user.email !== process.env.OWNER_EMAIL) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
}; 