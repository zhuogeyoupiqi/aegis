package com.aegis.system.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

/**
 * 系统配置读取服务。
 *
 * 当前刻意不加缓存：读的是每次发包前的白名单校验，QPS 极低（人手点出来的），
 * 直查数据库最简单可靠；等真出现热点配置再加 Spring Cache 一行事。
 */
@Service
public class SysConfigService {

    private final SysConfigMapper sysConfigMapper;

    public SysConfigService(SysConfigMapper sysConfigMapper) {
        this.sysConfigMapper = sysConfigMapper;
    }

    /**
     * 按键取配置值。
     *
     * @param cfgKey 配置键
     * @param defaultValue 键不存在或值为空时的返回值：调用方显式给默认，
     *                     避免所有调用点都要处理 null
     */
    public String getValue(String cfgKey, String defaultValue) {
        SysConfigDO row = sysConfigMapper.selectOne(
                new LambdaQueryWrapper<SysConfigDO>().eq(SysConfigDO::getCfgKey, cfgKey));
        return row == null || row.getCfgValue() == null || row.getCfgValue().isBlank()
                ? defaultValue : row.getCfgValue();
    }
}
