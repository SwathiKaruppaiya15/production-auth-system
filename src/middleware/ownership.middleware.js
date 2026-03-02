const requireOwnership = (resourceIdParam = 'id', allowAdmin = true) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const resourceUserId = req.params[resourceIdParam];
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Admin can access any resource if allowed
    if (allowAdmin && userRole === 'admin') {
      return next();
    }

    // User can only access their own resources
    if (resourceUserId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only access your own resources'
      });
    }

    next();
  };
};

const requireOwnershipOrAdmin = requireOwnership();

module.exports = {
  requireOwnership,
  requireOwnershipOrAdmin
};
