package com.aegis.soc.syslog;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 创建发送任务的请求体。
 *
 * 校验注解在这里声明、由 Controller 的 @Valid 触发、GlobalExceptionHandler 兜底转 Result——
 * 三层各干一件事，Controller 里不出现手写 if 校验（方案文档分层约定）。
 * 类比前端：相当于 antd Form 的 rules 定义，提交前统一校验。
 */
public class TaskCreateDTO {

    /** IPv4 字面量正则：白名单校验在 Service 里做（这里只管格式）。预设 DTO 复用同一份 */
    public static final String IPV4_PATTERN =
            "^((25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)$";

    /** 目标 IP：必须 IPv4 字面量（不发域名——域名解析结果不受白名单约束） */
    @NotBlank(message = "目标 IP 不能为空")
    @Pattern(regexp = IPV4_PATTERN, message = "目标 IP 必须是合法的 IPv4 地址")
    private String targetIp;

    /** 目标端口：避开 0；上限给到 65535 */
    @NotNull(message = "目标端口不能为空")
    @Min(value = 1, message = "目标端口最小为 1")
    @Max(value = 65535, message = "目标端口最大为 65535")
    private Integer targetPort;

    /**
     * 渲染后的最终报文列表（模板变量已由前端逐条替换——渲染在前端，方案文档 §2.2.3）。
     * 列表长度即发送条数，不再单独传 count：两个数字一旦不一致，留痕和实发就对不上了。
     * 每条上限 8KB（真实 syslog 报文一般 < 1KB，超长说明前端渲染出了问题，直接拒）；
     * 容器元素注解（List&lt;@NotBlank...&gt;）会校验到列表里的每个元素。
     */
    @NotEmpty(message = "报文列表不能为空")
    @Size(max = 2000, message = "单次任务最多 2000 条")
    private List<@NotBlank(message = "报文内容不能为空") @Size(max = 8192, message = "单条报文不能超过 8KB") String> payloads;

    /** 模板 key（用于留痕，标记这批报文是什么格式） */
    @NotBlank(message = "模板 key 不能为空")
    private String templateKey;

    /** 发送间隔：最小 20ms 防止打爆目标采集器 */
    @NotNull(message = "发送间隔不能为空")
    @Min(value = 20, message = "发送间隔最小 20ms")
    @Max(value = 60000, message = "发送间隔最大 60s")
    private Integer intervalMs;

    public String getTargetIp() {
        return targetIp;
    }

    public void setTargetIp(String targetIp) {
        this.targetIp = targetIp;
    }

    public Integer getTargetPort() {
        return targetPort;
    }

    public void setTargetPort(Integer targetPort) {
        this.targetPort = targetPort;
    }

    public List<String> getPayloads() {
        return payloads;
    }

    public void setPayloads(List<String> payloads) {
        this.payloads = payloads;
    }

    public String getTemplateKey() {
        return templateKey;
    }

    public void setTemplateKey(String templateKey) {
        this.templateKey = templateKey;
    }

    public Integer getIntervalMs() {
        return intervalMs;
    }

    public void setIntervalMs(Integer intervalMs) {
        this.intervalMs = intervalMs;
    }
}
