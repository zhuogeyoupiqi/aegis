package com.aegis.asset.repo;

import java.util.List;

/**
 * 资产分页结果。刻意收窄不回 MyBatis-Plus 的 Page：
 * 不把 current/size/optimize 等框架细节漏给前端契约。
 */
public record ItemPageVO(long total, List<ItemVO> items) {
}
