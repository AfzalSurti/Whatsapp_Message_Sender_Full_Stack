const jwt=require('jsonwebtoken');

const verifyToken=(token)=>{
    const decoded=jwt.verify(token,process.env.JWT_SECRET);
    return decoded.id; // return user ID from token
};

module.exports=verifyToken;