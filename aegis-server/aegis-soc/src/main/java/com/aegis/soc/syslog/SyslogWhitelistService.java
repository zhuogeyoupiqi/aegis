package com.aegis.soc.syslog;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.aegis.common.util.CidrMatcher;
import com.aegis.system.config.SysConfigService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 发包目标白名单校验。
 *
 * 这是发包器的安全边界（方案文档 §6.1 风险表：UDP 发包被滥用为内网探测）：
 * 前端的白名单提示只是体验层，这里才是强制的——绕过页面直接调接口同样被拦。
 *
 * 网段来源：sys_config 表的 syslog.whitelist（JSON 数组，运行期可改），
 * 配置缺失或格式非法时回退到 RFC1918 + 回环的默认集（安全默认：宁可拦错不可放过）。
 */
@Service
public class SyslogWhitelistService {

    private static final Logger log = LoggerFactory.getLogger(SyslogWhitelistService.class);

    /** 配置键：内网白名单网段（JSON 数组字符串） */
    public static final String CONFIG_KEY = "syslog.whitelist";

    /** 兜底网段：三大私有网段 + 回环，配置不可用时按这个执行 */
    private static final String[] DEFAULT_CIDRS = {
            "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8"
    };

    private final SysConfigService sysConfigService;
    private final ObjectMapper objectMapper;

    public SyslogWhitelistService(SysConfigService sysConfigService, ObjectMapper objectMapper) {
        this.sysConfigService = sysConfigService;
        this.objectMapper = objectMapper;
    }

    /**
     * 校验目标 IP，不在白名单内直接抛业务异常（全局异常处理器转 Result 给前端）。
     */
    public void checkTargetAllowed(String targetIp) {
        if (!CidrMatcher.matchesAny(targetIp, loadCidrs())) {
            throw new BizException(ErrorCode.TARGET_NOT_ALLOWED,
                    "目标 " + targetIp + " 不在白名单网段内，已拦截（白名单可在 sys_config.syslog.whitelist 调整）");
        }
    }

    /** 读取并解析白名单网段；解析失败记日志并回退默认集，不让一条脏配置弄挂整个发包功能 */
    private String[] loadCidrs() {
        String raw = sysConfigService.getValue(CONFIG_KEY, null);
        if (raw == null || raw.isBlank()) {
            return DEFAULT_CIDRS;
        }
        try {
            JsonNode array = objectMapper.readTree(raw);
            if (array.isArray() && !array.isEmpty()) {
                String[] cidrs = new String[array.size()];
                for (int i = 0; i < array.size(); i++) {
                    cidrs[i] = array.get(i).asText();
                }
                return cidrs;
            }
        } catch (Exception e) {
            log.warn("白名单配置解析失败，回退默认网段 raw={}", raw, e);
        }
        return DEFAULT_CIDRS;
    }
}
