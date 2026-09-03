package com.aegis.asset.repo;

import com.aegis.common.exception.BizException;
import com.aegis.common.result.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 资产仓库的读写与检索。
 *
 * 检索按方案文档 §5.3 的 MVP 口径：MySQL LIKE + 标签精确匹配（FIND_IN_SET），
 * 个人库量级（几百条）全表扫无感；量级上来再演进 Meilisearch，接口形状不变。
 * 默认排序 copy_count 降序——复制次数是"这资产我常用"的最诚实信号。
 * kw 对 content 的 LIKE 在 V2 依然有效：代码全文内联在 JSON 里，命中即中。
 */
@Service
public class AssetItemService {

    /** 标签上限：多了说明该拆资产了，筛选项也会被稀释 */
    private static final int MAX_TAGS = 8;

    /** 文件数上限：对应前端文件夹导入的上限，超过 100 个说明拖进了整个工程而不是某个组件 */
    private static final int MAX_FILES = 100;

    /** 依赖数上限：import map 的 sane 边界，预打包产物也不可能覆盖几百个包 */
    private static final int MAX_DEPS = 30;

    private final AssetItemMapper itemMapper;

    public AssetItemService(AssetItemMapper itemMapper) {
        this.itemMapper = itemMapper;
    }

    /**
     * 分页检索：关键字（名字/说明/正文三列模糊）+ 类型精确 + 标签精确，全部可选组合。
     * 标签用 FIND_IN_SET 而不是 LIKE：逗号串里 LIKE "%java%" 会误中 "javascript"，
     * FIND_IN_SET 按整段精确比较，天然规避前缀歧义。
     */
    public ItemPageVO page(int current, int size, String kw, String type, String tag) {
        String keyword = escapeLike(trimToNull(kw));
        String typeVal = trimToNull(type);
        String tagVal = trimToNull(tag);

        LambdaQueryWrapper<AssetItemDO> wrapper = new LambdaQueryWrapper<AssetItemDO>()
                .eq(typeVal != null, AssetItemDO::getType, typeVal)
                .apply(tagVal != null, "FIND_IN_SET({0}, tags)", tagVal)
                // 关键字是"任一列命中即算"的 OR 语义，and(...) 包一层避免污染外层条件的 AND 链
                .and(keyword != null, w -> w.like(AssetItemDO::getName, keyword)
                        .or().like(AssetItemDO::getDescription, keyword)
                        .or().like(AssetItemDO::getContent, keyword))
                // 对 LIKE 通配符 % _ 做转义，避免用户搜 "%" 匹配全部
                .last(keyword != null, "ESCAPE '\\'")
                .orderByDesc(AssetItemDO::getCopyCount)
                .orderByDesc(AssetItemDO::getUpdateTime);

        Page<AssetItemDO> page = itemMapper.selectPage(
                // 单页上限 100：防手滑翻全表，个人库也远用不到
                new Page<>(current, Math.min(Math.max(size, 1), 100)), wrapper);
        return new ItemPageVO(page.getTotal(), page.getRecords().stream().map(ItemVO::from).toList());
    }

    /** 新增资产：copy_count 显式置 0（不依赖列默认值，读到 null 的排查成本更高） */
    public void create(ItemSaveDTO dto) {
        AssetItemDO item = new AssetItemDO();
        applyFields(item, dto);
        item.setCopyCount(0);
        itemMapper.insert(item);
    }

    /** 更新资产：先读后写，既给出明确的 404 语义，也顺带带上 version 走乐观锁 */
    public void update(long id, ItemSaveDTO dto) {
        AssetItemDO item = requireItem(id);
        applyFields(item, dto);
        if (itemMapper.updateById(item) == 0) {
            // 走到这里说明并发场景下被删了（读取时还在），对调用方而言就是不存在
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /** 删除资产（逻辑删除）；删不存在的按业务异常返回而不是静默成功 */
    public void delete(long id) {
        if (itemMapper.deleteById(id) == 0) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /**
     * 复制计数 +1。用 setSql 原子自增而不是"读出来 +1 再写回"：
     * 后者在并发点同一资产的两次复制会丢一次计数。
     */
    public void incrementCopy(long id) {
        int affected = itemMapper.update(null, new LambdaUpdateWrapper<AssetItemDO>()
                .setSql("copy_count = copy_count + 1")
                .eq(AssetItemDO::getId, id));
        if (affected == 0) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
    }

    /** 读到即返回，读不到统一抛 404（更新/删除共用的存在性语义） */
    private AssetItemDO requireItem(long id) {
        AssetItemDO item = itemMapper.selectById(id);
        if (item == null) {
            throw new BizException(ErrorCode.NOT_FOUND, "资产不存在或已删除");
        }
        return item;
    }

    /** 新增/更新共用的字段映射，两处写一遍迟早漂移 */
    private void applyFields(AssetItemDO item, ItemSaveDTO dto) {
        item.setName(dto.getName());
        item.setType(dto.getType());
        item.setLang(trimToNull(dto.getLang()));
        item.setDescription(trimToNull(dto.getDescription()));
        item.setContent(buildContent(dto));
        item.setTags(normalizeTags(dto.getTags()));
    }

    /**
     * 正文落库的统一出口，同时是 V2 形状的校验收口：
     * DTO 只管单字段长度（@Size/@NotBlank），跨字段的形状规则（link 与 files 互斥、
     * entry 必须命中文件路径、文件数/依赖数上限）都在这里——新增和更新共用一份逻辑。
     */
    private String buildContent(ItemSaveDTO dto) {
        if ("link".equals(dto.getType())) {
            if (trimToNull(dto.getUrl()) == null) {
                throw new BizException(ErrorCode.BAD_PARAM, "link 类型必须提供 url");
            }
            if (dto.getFiles() != null && !dto.getFiles().isEmpty()) {
                throw new BizException(ErrorCode.BAD_PARAM, "link 类型不能携带文件");
            }
            return dto.getUrl().trim();
        }

        List<AssetFileDTO> files = normalizeFiles(dto.getFiles());
        String entry = normalizeEntry(dto.getEntry());
        if (entry != null && files.stream().noneMatch(f -> f.getPath().equals(entry))) {
            throw new BizException(ErrorCode.BAD_PARAM, "预览入口 entry 必须是文件清单里的路径");
        }
        return AssetContentCodec.serialize(files, entry, normalizeDeps(dto.getDeps()));
    }

    /**
     * 文件清单规范化：剥 ./ 前缀、拒绝绝对路径与 .. 逃逸段、按路径去重（后到覆盖，
     * 文件夹导入时同名文件视为编辑而不是报错）、限数。
     */
    private List<AssetFileDTO> normalizeFiles(List<AssetFileDTO> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new BizException(ErrorCode.BAD_PARAM, "非 link 类型必须至少提供一个文件");
        }
        if (raw.size() > MAX_FILES) {
            throw new BizException(ErrorCode.BAD_PARAM, "文件数最多 " + MAX_FILES + " 个");
        }
        Map<String, AssetFileDTO> byPath = new LinkedHashMap<>();
        for (AssetFileDTO f : raw) {
            String path = f.getPath() == null ? "" : f.getPath().trim();
            // 剥除所有前导 "./"，防止 "././foo.vue" 残留前缀导致匹配失败
            while (path.startsWith("./")) {
                path = path.substring(2);
            }
            // 路径合法性：非空、非绝对路径、无 .. 段（防 "../escape" 写出资产根的语义）
            if (path.isEmpty() || path.startsWith("/") || List.of(path.split("/")).contains("..")) {
                throw new BizException(ErrorCode.BAD_PARAM, "文件路径不合法: " + f.getPath());
            }
            f.setPath(path);
            byPath.put(path, f);
        }
        return new ArrayList<>(byPath.values());
    }

    /** 依赖清单规范化：限数、字段 trim、按 name 去重（后到覆盖，扫描器与手填并存时的合并语义） */
    private List<AssetDepDTO> normalizeDeps(List<AssetDepDTO> raw) {
        if (raw == null) {
            return List.of();
        }
        if (raw.size() > MAX_DEPS) {
            throw new BizException(ErrorCode.BAD_PARAM, "依赖数最多 " + MAX_DEPS + " 个");
        }
        Map<String, AssetDepDTO> byName = new LinkedHashMap<>();
        for (AssetDepDTO d : raw) {
            if (d.getName() != null) {
                d.setName(d.getName().trim());
            }
            if (d.getVersion() != null) {
                d.setVersion(d.getVersion().trim());
            }
            if (d.getName() == null || d.getName().isEmpty()) {
                throw new BizException(ErrorCode.BAD_PARAM, "依赖名不能为空");
            }
            byName.put(d.getName(), d);
        }
        return new ArrayList<>(byName.values());
    }

    /** entry 单独走一遍 trim：与文件路径的规范化口径保持一致，比对才不会假性失配 */
    private String normalizeEntry(String entry) {
        String trimmed = trimToNull(entry);
        // 剥除所有前导 "./"，与文件路径规范化口径保持一致
        while (trimmed != null && trimmed.startsWith("./")) {
            trimmed = trimmed.substring(2);
        }
        return trimmed;
    }

    /**
     * 标签规范化：逗号分隔 → trim → 小写 → 去重 → 重新拼接。
     * 小写化让 "Vue" 与 "vue" 不会变成两个筛选项；空串统一存 "" 方便 FIND_IN_SET。
     */
    private String normalizeTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        List<String> seen = new ArrayList<>();
        for (String part : raw.split(",")) {
            String tag = part.trim().toLowerCase();
            if (!tag.isEmpty() && !seen.contains(tag)) {
                seen.add(tag);
            }
        }
        if (seen.size() > MAX_TAGS) {
            throw new BizException(ErrorCode.BAD_PARAM, "标签最多 " + MAX_TAGS + " 个");
        }
        return String.join(",", seen);
    }

    private String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * 对 LIKE 通配符做转义：% _ 分别加反斜杠前缀，同时先把已有的 \ 转义成 \\
     * 顺序不能换——必须先处理反斜杠，否则后面加的反斜杠会被再次转义。
     */
    private String escapeLike(String kw) {
        if (kw == null) {
            return null;
        }
        return kw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
