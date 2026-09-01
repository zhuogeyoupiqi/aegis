package com.aegis.soc.syslog;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 保存发送配置预设的请求体。
 *
 * 注意这里只校验 IP 格式、不做白名单校验：保存配置 ≠ 发送，
 * 白名单在真正发包时（TaskCreateDTO 路径）才强制——允许提前收藏一个
 * "以后要放开的目标"，到发送时如果仍不在白名单自然会被拦。
 */
public class PresetCreateDTO {

    @NotBlank(message = "预设名不能为空")
    @Size(max = 64, message = "预设名最长 64 字")
    private String name;

    @NotBlank(message = "目标 IP 不能为空")
    @Pattern(regexp = TaskCreateDTO.IPV4_PATTERN, message = "目标 IP 必须是合法的 IPv4 地址")
    private String targetIp;

    @NotNull(message = "目标端口不能为空")
    @Min(value = 1, message = "目标端口最小为 1")
    @Max(value = 65535, message = "目标端口最大为 65535")
    private Integer targetPort;

    @NotBlank(message = "模板 key 不能为空")
    private String templateKey;

    /** 模板编辑框的全文（用户可能手改过，复现要以它为准） */
    @NotBlank(message = "模板内容不能为空")
    @Size(max = 8192, message = "模板内容最长 8KB")
    private String templateContent;

    @NotNull(message = "发送条数不能为空")
    @Min(value = 1, message = "发送条数最小为 1")
    @Max(value = 2000, message = "单次任务最多 2000 条")
    private Integer count;

    @NotNull(message = "发送间隔不能为空")
    @Min(value = 20, message = "发送间隔最小 20ms")
    @Max(value = 60000, message = "发送间隔最大 60s")
    private Integer intervalMs;

    /** 变量随机化开关（缺省按开处理，与页面默认一致） */
    private Boolean randomize;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

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

    public String getTemplateKey() {
        return templateKey;
    }

    public void setTemplateKey(String templateKey) {
        this.templateKey = templateKey;
    }

    public String getTemplateContent() {
        return templateContent;
    }

    public void setTemplateContent(String templateContent) {
        this.templateContent = templateContent;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }

    public Integer getIntervalMs() {
        return intervalMs;
    }

    public void setIntervalMs(Integer intervalMs) {
        this.intervalMs = intervalMs;
    }

    public Boolean getRandomize() {
        return randomize;
    }

    public void setRandomize(Boolean randomize) {
        this.randomize = randomize;
    }
}
