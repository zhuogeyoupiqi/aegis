package com.aegis.common.util;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * CIDR 网段匹配器：判断 IP 是否落在给定网段内（如 10.0.0.0/8）。
 *
 * 用在哪：syslog 发包的目标白名单校验——前端的白名单提示只是体验层，
 * 后端这道才是安全边界（绕过页面直接调接口也拦得住）。
 *
 * 为什么手写而不用 commons-net：只用到"IPv4 是否在网段内"一个能力，
 * 引一个网络库不如 30 行代码直观，学习期也更愿意读。
 */
public final class CidrMatcher {

    private CidrMatcher() {
    }

    /**
     * 判断 ip 是否命中任一 CIDR 网段。
     *
     * @param ip    点分十进制 IPv4，如 "10.20.1.5"
     * @param cidrs CIDR 数组，如 {"10.0.0.0/8", "192.168.0.0/16"}；不支持 IPv6（内网场景够用）
     * @return 命中返回 true；ip 非法或为 IPv6 时返回 false（非法目标一律不放行，安全默认）
     */
    public static boolean matchesAny(String ip, String[] cidrs) {
        long ipValue = parseIpv4(ip);
        if (ipValue < 0) {
            return false;
        }
        for (String cidr : cidrs) {
            long[] range = parseCidr(cidr);
            if (range != null && ipValue >= range[0] && ipValue <= range[1]) {
                return true;
            }
        }
        return false;
    }

    /** 把点分十进制 IPv4 转成 long（大端序数值），便于与网段范围比较；非法返回 -1 */
    private static long parseIpv4(String ip) {
        try {
            InetAddress addr = InetAddress.getByName(ip);
            // 域名解析出来的可能是 IPv6 或非自身字面量，白名单校验只认字面量 IPv4
            if (!(addr instanceof Inet4Address) || !addr.getHostAddress().equals(ip)) {
                return -1;
            }
            byte[] bytes = addr.getAddress();
            return ((long) (bytes[0] & 0xFF) << 24)
                    | ((long) (bytes[1] & 0xFF) << 16)
                    | ((long) (bytes[2] & 0xFF) << 8)
                    | (long) (bytes[3] & 0xFF);
        } catch (UnknownHostException e) {
            return -1;
        }
    }

    /** 把 CIDR 转成 [起, 止] 数值范围；格式非法返回 null */
    private static long[] parseCidr(String cidr) {
        String[] parts = cidr.trim().split("/");
        if (parts.length != 2) {
            return null;
        }
        long base = parseIpv4(parts[0]);
        if (base < 0) {
            return null;
        }
        int prefix;
        try {
            prefix = Integer.parseInt(parts[1]);
        } catch (NumberFormatException e) {
            return null;
        }
        if (prefix < 0 || prefix > 32) {
            return null;
        }
        // 掩码取反得到主机位全 1 的偏移：如 /8 → 后 24 位全 1
        long hostBits = 32 - prefix;
        long mask = hostBits == 32 ? -1L : (1L << hostBits) - 1;
        return new long[]{base & ~mask, base | mask};
    }
}
