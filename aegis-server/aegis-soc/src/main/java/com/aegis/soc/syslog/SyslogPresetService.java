package com.aegis.soc.syslog;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 发送配置预设的读写。逻辑极薄（列表/新增/删除），但依然独立成 Service：
 * Controller 不碰 Mapper 是分层铁律，且后续加"预设使用计数/分享"有落脚点。
 */
@Service
public class SyslogPresetService {

    private final SocSendPresetMapper presetMapper;

    public SyslogPresetService(SocSendPresetMapper presetMapper) {
        this.presetMapper = presetMapper;
    }

    /** 预设列表：新存的排前面（收藏夹习惯，最常用的最新存） */
    public List<PresetVO> list() {
        List<SocSendPresetDO> rows = presetMapper.selectList(
                new LambdaQueryWrapper<SocSendPresetDO>()
                        .orderByDesc(SocSendPresetDO::getCreateTime));
        return rows.stream().map(PresetVO::from).toList();
    }

    /** 保存预设：同名不查重——收藏夹允许起一样的名字，用户自己管理 */
    public void create(PresetCreateDTO dto) {
        SocSendPresetDO preset = new SocSendPresetDO();
        preset.setName(dto.getName());
        preset.setTargetIp(dto.getTargetIp());
        preset.setTargetPort(dto.getTargetPort());
        preset.setTemplateKey(dto.getTemplateKey());
        preset.setTemplateContent(dto.getTemplateContent());
        preset.setCount(dto.getCount());
        preset.setIntervalMs(dto.getIntervalMs());
        // 前端漏传时按页面默认的"开"处理，避免复现时随机化悄悄失效
        preset.setRandomize(dto.getRandomize() == null || dto.getRandomize());
        presetMapper.insert(preset);
    }

    /** 删除预设（逻辑删除）；删不存在的按业务异常返回而不是静默成功 */
    public void delete(long id) {
        if (presetMapper.deleteById(id) == 0) {
            throw new BizException(ErrorCode.NOT_FOUND, "预设不存在或已删除");
        }
    }
}
