// Validate IPv4 address
exports.validateIpAddress = (ip) => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) return false;

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

// Validate IPv4 CIDR range
exports.validateIpRange = (range) => {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(range)) return false;

  const [ip, prefix] = range.split('/');
  const prefixNum = parseInt(prefix, 10);
  
  if (prefixNum < 0 || prefixNum > 32) return false;
  
  return exports.validateIpAddress(ip);
}; 