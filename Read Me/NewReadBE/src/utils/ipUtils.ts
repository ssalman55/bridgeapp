/**
 * Validates an IPv4 address
 * @param ip The IP address to validate
 * @returns true if the IP address is valid
 */
export const isValidIpAddress = (ip: string): boolean => {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    return false;
  }

  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
};

/**
 * Validates an IPv4 CIDR range (e.g., 192.168.1.0/24)
 * @param range The CIDR range to validate
 * @returns true if the range is valid
 */
export const isValidIpRange = (range: string): boolean => {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrRegex.test(range)) {
    return false;
  }

  const [ip, prefix] = range.split('/');
  const prefixNum = parseInt(prefix, 10);

  return isValidIpAddress(ip) && prefixNum >= 0 && prefixNum <= 32;
};

/**
 * Converts an IP address to a 32-bit number
 * @param ip The IP address to convert
 * @returns The 32-bit representation of the IP
 */
const ipToLong = (ip: string): number => {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
};

/**
 * Checks if an IP address falls within a CIDR range
 * @param ip The IP address to check
 * @param range The CIDR range (e.g., 192.168.1.0/24)
 * @returns true if the IP is in the range
 */
export const isIpInRange = (ip: string, range: string): boolean => {
  if (!isValidIpAddress(ip) || !isValidIpRange(range)) {
    return false;
  }

  const [baseIp, prefix] = range.split('/');
  const prefixNum = parseInt(prefix, 10);
  const mask = ~((1 << (32 - prefixNum)) - 1) >>> 0;

  const ipLong = ipToLong(ip);
  const baseIpLong = ipToLong(baseIp);

  return (ipLong & mask) === (baseIpLong & mask);
}; 