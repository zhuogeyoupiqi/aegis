package com.aegis.system.config;

import com.aegis.framework.mybatis.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;

/**
 * 系统配置表（sys_config）：key-value 型配置落库，运行期可改、无需重启。
 *
 * 与 application.yml 的分工：yml 管"部署环境相关"（端口、数据源），
 * 数据库管"业务运营相关"（白名单网段、开关阈值）——后者改一次要发版就没意义了。
 */
@TableName("sys_config")
public class SysConfigDO extends BaseEntity {

    /** 配置键：全局唯一，点分命名空间（如 syslog.whitelist） */
    private String cfgKey;

    /** 配置值：字符串存储，结构化内容（如 JSON 数组）由读取方解析 */
    private String cfgValue;

    /** 人读备注：这条配置是干嘛的、改了会怎样 */
    private String remark;

    public String getCfgKey() {
        return cfgKey;
    }

    public void setCfgKey(String cfgKey) {
        this.cfgKey = cfgKey;
    }

    public String getCfgValue() {
        return cfgValue;
    }

    public void setCfgValue(String cfgValue) {
        this.cfgValue = cfgValue;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
