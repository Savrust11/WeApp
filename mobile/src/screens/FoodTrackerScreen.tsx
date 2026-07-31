import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Check, AlertTriangle, Circle, Plus, Search, CalendarDays,
  EyeOff, Eye, ChevronUp, Pencil, Trash2,
} from 'lucide-react-native';
import { useAuthStore } from '../store/authStore';
import { useChildStore } from '../store/childStore';
import { apiGet, apiPost, apiRequest } from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { palette, fonts, radius, shadows } from '../theme/tokens';
import { Card, Button, Text, Title, Muted } from '../theme/ui';
import DatePickerModal from '../components/DatePickerModal';

// ─── Status colors (verbatim from web FoodTracker.tsx tailwind palette) ───────
//  green-50 #F0FDF4  green-200 #BBF7D0  green-500 #22C55E  green-700 #15803D
//  orange-50 #FFF7ED orange-200 #FED7AA orange-400 #FB923C orange-500 #F97316 orange-700 #9A3412
//  gray-50 #F9FAFB   gray-100 #F3F4F6   gray-200 #E5E7EB   gray-400 #9CA3AF gray-600 #4B5563
//  purple-50 #FAF5FF purple-100 #F3E8FF purple-300 #D8B4FE purple-500 #A855F7 purple-600 #9333EA purple-700 #7E22CE
//  red-200 #FECACA   red-500 #EF4444

const STATUS_GREEN = '#22C55E';
const STATUS_GREEN_BG = '#F0FDF4';
const STATUS_GREEN_BORDER = '#BBF7D0';
const STATUS_GREEN_TEXT = '#15803D';
const STATUS_ORANGE = '#FB923C';
const STATUS_ORANGE_BG = '#FFF7ED';
const STATUS_ORANGE_BORDER = '#FED7AA';
const STATUS_ORANGE_TEXT = '#9A3412';
const PURPLE = '#A855F7';
const PURPLE_50 = '#FAF5FF';
const PURPLE_100 = '#F3E8FF';
const PURPLE_300 = '#D8B4FE';
const PURPLE_600 = '#9333EA';
const PURPLE_700 = '#7E22CE';
const GRAY_50 = '#F9FAFB';
const GRAY_100 = '#F3F4F6';
const GRAY_200 = '#E5E7EB';
const GRAY_400 = '#9CA3AF';
const GRAY_500 = '#6B7280';
const GRAY_600 = '#4B5563';
const GRAY_700 = '#374151';
const RED_200 = '#FECACA';
const RED_500 = '#EF4444';

// ─── Static data ──────────────────────────────────────────────────────────────

const FOOD_CATEGORIES: { id: string; label: string; items: string[] }[] = [
  {
    id: 'grains', label: '穀類',
    items: ['おかゆ（10倍がゆ）', 'おかゆ（7倍がゆ）', 'パン', 'うどん', 'そうめん', 'パスタ', 'オートミール'],
  },
  {
    id: 'vegetables', label: '野菜',
    items: ['にんじん', 'かぼちゃ', 'ほうれん草', '小松菜', 'ブロッコリー', 'トマト', 'さつまいも', 'じゃがいも', '大根', '玉ねぎ', 'キャベツ', 'なす', 'とうもろこし'],
  },
  {
    id: 'fruits', label: '果物',
    items: ['りんご', 'バナナ', 'みかん', 'いちご', 'もも', 'ぶどう', 'メロン', 'すいか', '梨', 'キウイ'],
  },
  {
    id: 'protein_beans', label: 'たんぱく質（豆類）',
    items: ['豆腐', '納豆', 'きなこ', '枝豆'],
  },
  {
    id: 'protein_fish', label: 'たんぱく質（魚）',
    items: ['しらす', 'たい', 'かれい', 'たら', 'さけ', 'まぐろ', 'ツナ（水煮）'],
  },
  {
    id: 'protein_meat', label: 'たんぱく質（肉）',
    items: ['鶏ささみ', '鶏むね肉', '鶏もも肉', '豚ひき肉', '牛ひき肉', 'レバー'],
  },
  {
    id: 'protein_egg_dairy', label: 'たんぱく質（卵・乳）',
    items: ['卵黄', '全卵', '牛乳', 'ヨーグルト', 'チーズ'],
  },
  {
    id: 'other', label: 'その他',
    items: ['海苔', 'わかめ', 'ごま', 'だし（かつお）', 'だし（昆布）', 'しょうゆ', 'みそ', 'バター'],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type IngredientStatus = 'not_tried' | 'ok' | 'caution';

interface FoodIngredient {
  id: number;
  childId: number;
  familyId: string;
  ingredientName: string;
  category: string;
  status: IngredientStatus;
  firstTriedDate?: string | null;
  notes?: string | null;
  isCustom?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getHiddenKey(familyId: string, childId: number) {
  return `food_hidden_${familyId}_${childId}`;
}

async function loadHiddenSet(familyId: string, childId: number): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(getHiddenKey(familyId, childId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveHiddenSet(familyId: string, childId: number, set: Set<string>) {
  await AsyncStorage.setItem(getHiddenKey(familyId, childId), JSON.stringify(Array.from(set)));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FoodTrackerScreen() {
  const { user } = useAuthStore();
  const { activeChildId } = useChildStore();
  const activeChild = useChildStore((s) => s.activeChild());
  const familyId = user?.familyId ?? '';
  const queryClient = useQueryClient();
  const childId = activeChildId ?? 0;
  const { isDark } = useTheme();

  // Filter / search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Hidden items
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [showHiddenSection, setShowHiddenSection] = useState(false);

  React.useEffect(() => {
    if (childId && familyId) {
      loadHiddenSet(familyId, childId).then(setHiddenItems);
    }
  }, [childId, familyId]);

  // Detail sheet state
  const [sheetItem, setSheetItem] = useState<{ name: string; category: string } | null>(null);
  const [sheetStatus, setSheetStatus] = useState<IngredientStatus | null>(null);
  const [sheetDate, setSheetDate] = useState(todayStr());
  const [showSheetDatePicker, setShowSheetDatePicker] = useState(false);
  const [sheetNote, setSheetNote] = useState('');

  // Context menu (long-press)
  const [contextTarget, setContextTarget] = useState<{ name: string; category: string; isHidden: boolean; isCustom?: boolean; id?: number } | null>(null);
  const [confirmHide, setConfirmHide] = useState<{ name: string; category: string } | null>(null);

  // Add custom food modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState('other');

  // Edit / delete custom food
  const [editCustomOpen, setEditCustomOpen] = useState(false);
  const [editCustomId, setEditCustomId] = useState<number | null>(null);
  const [editCustomName, setEditCustomName] = useState('');
  const [editCustomCategory, setEditCustomCategory] = useState('other');
  const [confirmDeleteCustom, setConfirmDeleteCustom] = useState<{ id: number; name: string } | null>(null);

  // ── API ──────────────────────────────────────────────────────────────────────

  const { data: savedIngredients = [], isLoading } = useQuery({
    queryKey: ['foodIngredients', familyId, childId],
    queryFn: () => apiGet<FoodIngredient[]>(`/api/families/${familyId}/food-ingredients/${childId}`),
    enabled: !!familyId && !!childId,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<FoodIngredient>) =>
      apiPost(`/api/families/${familyId}/food-ingredients`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foodIngredients', familyId, childId] }),
    onError: () => Alert.alert('エラー', '更新に失敗しました。'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; ingredientName?: string; category?: string }) =>
      apiRequest('PATCH', `/api/families/${familyId}/food-ingredients/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foodIngredients', familyId, childId] }),
    onError: () => Alert.alert('エラー', '更新に失敗しました。'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('DELETE', `/api/families/${familyId}/food-ingredients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['foodIngredients', familyId, childId] }),
    onError: () => Alert.alert('エラー', '削除に失敗しました。'),
  });

  // ── Derived data ──────────────────────────────────────────────────────────────

  const savedMap = useMemo(() => {
    const m = new Map<string, FoodIngredient>();
    savedIngredients.forEach((ing) => m.set(`${ing.category}:${ing.ingredientName}`, ing));
    return m;
  }, [savedIngredients]);

  const allItems = useMemo(() => {
    const builtIn: { name: string; category: string; isCustom: boolean }[] = [];
    FOOD_CATEGORIES.forEach((cat) =>
      cat.items.forEach((name) => builtIn.push({ name, category: cat.id, isCustom: false })),
    );
    const customItems = savedIngredients
      .filter((ing) => ing.isCustom)
      .map((ing) => ({ name: ing.ingredientName, category: ing.category, isCustom: true }));
    const map = new Map<string, { name: string; category: string; isCustom: boolean }>();
    [...builtIn, ...customItems].forEach((item) => map.set(`${item.category}:${item.name}`, item));
    return Array.from(map.values());
  }, [savedIngredients]);

  const stats = useMemo(() => {
    let tried = 0;
    let caution = 0;
    allItems.forEach((item) => {
      const s = savedMap.get(`${item.category}:${item.name}`)?.status;
      if (s === 'ok') tried++;
      if (s === 'caution') caution++;
    });
    return { total: allItems.length, tried, caution };
  }, [allItems, savedMap]);

  const progressPercent = stats.total > 0
    ? Math.round(((stats.tried + stats.caution) / stats.total) * 100)
    : 0;

  const getStatus = (category: string, name: string): IngredientStatus =>
    (savedMap.get(`${category}:${name}`)?.status as IngredientStatus) || 'not_tried';

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (!item.isCustom && hiddenItems.has(`${item.category}:${item.name}`)) return false;
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = !searchQuery || item.name.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, searchQuery, hiddenItems]);

  const hiddenVisibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (item.isCustom) return false;
      if (!hiddenItems.has(`${item.category}:${item.name}`)) return false;
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const matchSearch = !searchQuery || item.name.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [allItems, selectedCategory, searchQuery, hiddenItems]);

  const categoriesToShow =
    selectedCategory === 'all'
      ? FOOD_CATEGORIES
      : FOOD_CATEGORIES.filter((c) => c.id === selectedCategory);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const openSheet = (category: string, name: string) => {
    const status = getStatus(category, name);
    const saved = savedMap.get(`${category}:${name}`);
    setSheetItem({ name, category });
    setSheetStatus(status === 'not_tried' ? null : status);
    setSheetDate(saved?.firstTriedDate || todayStr());
    setSheetNote(saved?.notes || '');
  };

  const closeSheet = () => {
    setSheetItem(null);
    setSheetStatus(null);
    setSheetDate(todayStr());
    setSheetNote('');
  };

  const handleSheetSave = () => {
    if (!sheetItem || sheetStatus === null) { closeSheet(); return; }
    upsertMutation.mutate({
      childId,
      familyId,
      ingredientName: sheetItem.name,
      category: sheetItem.category,
      status: sheetStatus,
      firstTriedDate: sheetStatus === 'not_tried' ? null : (sheetDate || todayStr()),
      notes: sheetStatus === 'caution' ? (sheetNote || null) : null,
    });
    closeSheet();
  };

  const hideItem = (category: string, name: string) => {
    const key = `${category}:${name}`;
    const next = new Set(hiddenItems);
    next.add(key);
    setHiddenItems(next);
    saveHiddenSet(familyId, childId, next);
    setConfirmHide(null);
  };

  const unhideItem = (category: string, name: string) => {
    const key = `${category}:${name}`;
    const next = new Set(hiddenItems);
    next.delete(key);
    setHiddenItems(next);
    saveHiddenSet(familyId, childId, next);
    setContextTarget(null);
  };

  const addCustomFood = () => {
    if (!customName.trim()) return;
    if (!childId) { Alert.alert('子どもを選択してください'); return; }
    upsertMutation.mutate({
      childId,
      familyId,
      ingredientName: customName.trim(),
      category: customCategory,
      status: 'ok',
      firstTriedDate: todayStr(),
      isCustom: true,
    });
    setCustomName('');
    setShowAddModal(false);
  };

  const submitEditCustom = () => {
    if (!editCustomName.trim() || !editCustomId) return;
    updateMutation.mutate(
      { id: editCustomId, ingredientName: editCustomName.trim(), category: editCustomCategory },
      { onSuccess: () => setEditCustomOpen(false) },
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderFoodCard = (
    item: { name: string; category: string; isCustom: boolean },
    isHidden = false,
  ) => {
    const status = getStatus(item.category, item.name);
    const saved = savedMap.get(`${item.category}:${item.name}`);

    let bgColor: string = palette.card;
    let borderColor: string = GRAY_200;
    let iconBg: string = GRAY_200;
    let iconColor: string = GRAY_400;
    let nameColor: string = GRAY_600;
    let StatusIcon: typeof Circle = Circle;
    let statusSize = 12;

    if (isHidden) {
      bgColor = GRAY_50; borderColor = GRAY_100;
      iconBg = GRAY_200; iconColor = GRAY_400; nameColor = GRAY_400;
    } else if (status === 'ok') {
      bgColor = STATUS_GREEN_BG; borderColor = STATUS_GREEN_BORDER;
      iconBg = STATUS_GREEN; iconColor = '#FFFFFF'; nameColor = STATUS_GREEN_TEXT;
      StatusIcon = Check; statusSize = 14;
    } else if (status === 'caution') {
      bgColor = STATUS_ORANGE_BG; borderColor = STATUS_ORANGE_BORDER;
      iconBg = STATUS_ORANGE; iconColor = '#FFFFFF'; nameColor = STATUS_ORANGE_TEXT;
      StatusIcon = AlertTriangle; statusSize = 14;
    }

    return (
      <TouchableOpacity
        key={`${item.category}:${item.name}`}
        style={[styles.foodCard, { backgroundColor: bgColor, borderColor }, isHidden && { opacity: 0.6 }]}
        onPress={() => { if (!isHidden) openSheet(item.category, item.name); }}
        onLongPress={() =>
          setContextTarget({
            name: item.name,
            category: item.category,
            isHidden,
            isCustom: item.isCustom,
            id: saved?.id,
          })
        }
        delayLongPress={600}
        activeOpacity={0.7}
      >
        <View style={[styles.foodIcon, { backgroundColor: iconBg }]}>
          <StatusIcon size={statusSize} color={iconColor} strokeWidth={2.5} />
        </View>
        <View style={styles.foodTextWrap}>
          <Text style={[styles.foodName, { color: nameColor }]} numberOfLines={1}>
            {item.name}
          </Text>
          {!isHidden && saved?.firstTriedDate ? (
            <Text style={styles.foodDate}>{saved.firstTriedDate}</Text>
          ) : null}
        </View>
        {item.isCustom ? (
          <Pencil size={12} color={PURPLE_300} strokeWidth={2.5} />
        ) : (
          <EyeOff size={12} color={isHidden ? GRAY_400 : GRAY_200} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────────

  if (!childId) {
    return (
      <View style={styles.centered}>
        <Card style={styles.emptyCard}>
          <Text style={styles.centeredText}>お子さまを登録してください</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title + child name (web: "食材チェックリスト" + active child) */}
        <Title style={styles.pageTitle}>食材チェックリスト</Title>
        {activeChild ? (
          <Text style={styles.childName}>{activeChild.name}</Text>
        ) : null}

        {/* Progress card */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>進捗</Text>
            <Text style={styles.progressValue}>
              {stats.tried + stats.caution} / {stats.total} 食材
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressLegend}>
            <View style={styles.legendItem}>
              <Check size={12} color={STATUS_GREEN} strokeWidth={2.5} />
              <Text style={styles.legendGreen}>{stats.tried} 食べた</Text>
            </View>
            <View style={styles.legendItem}>
              <AlertTriangle size={12} color={STATUS_ORANGE} strokeWidth={2.5} />
              <Text style={styles.legendOrange}>{stats.caution} 要注意</Text>
            </View>
          </View>
        </Card>

        {/* Search + Add button */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color={GRAY_400} />
            <TextInput
              style={styles.searchInput}
              placeholder="食材を検索..."
              placeholderTextColor={GRAY_400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <Button
            size="sm"
            onPress={() => setShowAddModal(true)}
            style={styles.addHeaderBtn}
          >
            <Plus size={16} color={palette.primaryForeground} />
            <Text style={styles.addHeaderBtnText}>食材追加</Text>
          </Button>
        </View>

        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {[{ id: 'all', label: 'すべて' }, ...FOOD_CATEGORIES].map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Food items grouped by category */}
        {isLoading ? (
          <ActivityIndicator color={PURPLE} style={{ marginTop: 40 }} />
        ) : (
          categoriesToShow.map((cat) => {
            const items = visibleItems.filter((i) => i.category === cat.id);
            if (items.length === 0) return null;
            return (
              <Card key={cat.id} style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryHeaderText}>{cat.label}</Text>
                </View>
                <View style={styles.foodGrid}>
                  {items.map((item) => renderFoodCard(item))}
                </View>
              </Card>
            );
          })
        )}

        {/* Hidden items section */}
        {hiddenVisibleItems.length > 0 && (
          <View style={styles.hiddenSection}>
            <TouchableOpacity
              style={styles.hiddenToggleBtn}
              onPress={() => setShowHiddenSection((v) => !v)}
            >
              {showHiddenSection ? (
                <ChevronUp size={15} color={GRAY_400} />
              ) : (
                <Eye size={15} color={GRAY_400} />
              )}
              <Text style={styles.hiddenToggleText}>
                {showHiddenSection
                  ? '非表示の食材を隠す'
                  : `非表示の食材を見る（${hiddenVisibleItems.length}件）`}
              </Text>
            </TouchableOpacity>
            {showHiddenSection && (
              <Card style={[styles.categorySection, { marginTop: 8 }]}>
                <View style={styles.hiddenCategoryHeader}>
                  <EyeOff size={14} color={GRAY_400} />
                  <Text style={styles.hiddenCategoryHeaderText}>非表示の食材</Text>
                </View>
                <View style={styles.foodGrid}>
                  {hiddenVisibleItems.map((item) => renderFoodCard(item, true))}
                </View>
              </Card>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Plus size={28} color={palette.primaryForeground} />
      </TouchableOpacity>

      {/* ── Detail Sheet Modal ──────────────────────────────────────────────────── */}
      <Modal
        visible={!!sheetItem}
        transparent
        animationType="slide"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeSheet}>
          <TouchableOpacity style={styles.sheetContainer} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>{sheetItem?.name}</Title>

            {/* not_tried option */}
            <TouchableOpacity
              style={[styles.statusOption, sheetStatus === 'not_tried' && styles.statusOptionGrayActive]}
              onPress={() => setSheetStatus('not_tried')}
            >
              <View style={[styles.statusOptionIcon, { backgroundColor: GRAY_200 }]}>
                <Circle size={16} color={GRAY_500} />
              </View>
              <View>
                <Text style={styles.statusOptionTitle}>まだ食べていない</Text>
                <Muted style={styles.statusOptionSub}>未試行に戻す・日付をクリア</Muted>
              </View>
            </TouchableOpacity>

            {/* ok option */}
            <TouchableOpacity
              style={[styles.statusOption, sheetStatus === 'ok' && styles.statusOptionGreenActive]}
              onPress={() => { setSheetStatus('ok'); if (!sheetDate) setSheetDate(todayStr()); }}
            >
              <View style={styles.statusOptionRow}>
                <View style={[styles.statusOptionIcon, { backgroundColor: STATUS_GREEN }]}>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusOptionTitle, { color: STATUS_GREEN_TEXT }]}>
                    食べた（問題なし）
                  </Text>
                  <Muted style={styles.statusOptionSub}>はじめて食べた日を記録（任意）</Muted>
                </View>
              </View>
              {sheetStatus === 'ok' && (
                <TouchableOpacity
                  style={[styles.dateRow, { borderColor: STATUS_GREEN_BORDER }]}
                  onPress={() => setShowSheetDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <CalendarDays size={16} color={STATUS_GREEN} />
                  <Text style={{ fontFamily: fonts.body, fontSize: 15, color: sheetDate ? palette.foreground : GRAY_400 }}>
                    {sheetDate || '日付を選ぶ'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* caution option */}
            <TouchableOpacity
              style={[styles.statusOption, sheetStatus === 'caution' && styles.statusOptionOrangeActive]}
              onPress={() => { setSheetStatus('caution'); if (!sheetDate) setSheetDate(todayStr()); }}
            >
              <View style={styles.statusOptionRow}>
                <View style={[styles.statusOptionIcon, { backgroundColor: STATUS_ORANGE }]}>
                  <AlertTriangle size={16} color="#FFFFFF" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusOptionTitle, { color: STATUS_ORANGE_TEXT }]}>
                    要注意（アレルギー反応あり）
                  </Text>
                  <Muted style={styles.statusOptionSub}>症状やメモを記録</Muted>
                </View>
              </View>
              {sheetStatus === 'caution' && (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.dateRow, { borderColor: STATUS_ORANGE_BORDER }]}
                    onPress={() => setShowSheetDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <CalendarDays size={16} color={STATUS_ORANGE} />
                    <Text style={{ fontFamily: fonts.body, fontSize: 15, color: sheetDate ? palette.foreground : GRAY_400 }}>
                      {sheetDate || '日付を選ぶ'}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.noteInput}
                    placeholder="症状やメモ（例: 口の周りが赤くなった）"
                    placeholderTextColor={GRAY_400}
                    value={sheetNote}
                    onChangeText={setSheetNote}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </TouchableOpacity>

            <Button
              onPress={handleSheetSave}
              disabled={sheetStatus === null || upsertMutation.isPending}
              style={[
                styles.saveBtn,
                sheetStatus === null && styles.saveBtnDisabled,
                sheetStatus === 'ok' && { backgroundColor: STATUS_GREEN, borderColor: STATUS_GREEN },
                sheetStatus === 'caution' && { backgroundColor: STATUS_ORANGE, borderColor: STATUS_ORANGE },
                sheetStatus === 'not_tried' && { backgroundColor: GRAY_500, borderColor: GRAY_500 },
              ]}
            >
              <Text style={styles.saveBtnText}>保存する</Text>
            </Button>
          </TouchableOpacity>
        </TouchableOpacity>
        {/* Calendar picker for 食べた/注意 dates — replaces manual YYYY-MM-DD input. */}
        <DatePickerModal
          visible={showSheetDatePicker}
          initialDate={sheetDate}
          maxDate={new Date()}
          title="日付を選ぶ"
          onConfirm={setSheetDate}
          onClose={() => setShowSheetDatePicker(false)}
        />
      </Modal>

      {/* ── Context Menu (long-press) ───────────────────────────────────────────── */}
      <Modal
        visible={!!contextTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setContextTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setContextTarget(null)}
        >
          <TouchableOpacity style={styles.contextMenu} activeOpacity={1}>
            <Title style={styles.contextTitle}>{contextTarget?.name}</Title>
            {contextTarget?.isCustom ? (
              <>
                <Button
                  onPress={() => {
                    if (!contextTarget) return;
                    const saved = savedMap.get(`${contextTarget.category}:${contextTarget.name}`);
                    setEditCustomId(contextTarget.id ?? saved?.id ?? null);
                    setEditCustomName(contextTarget.name);
                    setEditCustomCategory(saved?.category || contextTarget.category);
                    setEditCustomOpen(true);
                    setContextTarget(null);
                  }}
                  style={styles.contextBtn}
                >
                  <Pencil size={16} color={palette.primaryForeground} />
                  <Text style={styles.contextBtnTextLight}>名前・カテゴリを編集</Text>
                </Button>
                <Button
                  variant="outline"
                  onPress={() => {
                    if (!contextTarget) return;
                    const saved = savedMap.get(`${contextTarget.category}:${contextTarget.name}`);
                    const delId = contextTarget.id ?? saved?.id;
                    if (delId == null) return;
                    setConfirmDeleteCustom({ id: delId, name: contextTarget.name });
                    setContextTarget(null);
                  }}
                  style={[styles.contextBtn, { borderColor: RED_200 }]}
                >
                  <Trash2 size={16} color={RED_500} />
                  <Text style={[styles.contextBtnTextDark, { color: RED_500 }]}>削除する</Text>
                </Button>
              </>
            ) : contextTarget?.isHidden ? (
              <Button
                onPress={() => contextTarget && unhideItem(contextTarget.category, contextTarget.name)}
                style={styles.contextBtn}
              >
                <Eye size={16} color={palette.primaryForeground} />
                <Text style={styles.contextBtnTextLight}>再表示する</Text>
              </Button>
            ) : (
              <Button
                variant="outline"
                onPress={() => { setConfirmHide(contextTarget); setContextTarget(null); }}
                style={[styles.contextBtn, { borderColor: GRAY_200 }]}
              >
                <EyeOff size={16} color={GRAY_600} />
                <Text style={[styles.contextBtnTextDark, { color: GRAY_600 }]}>非表示にする</Text>
              </Button>
            )}
            <TouchableOpacity
              style={styles.contextCancelBtn}
              onPress={() => setContextTarget(null)}
            >
              <Text style={styles.contextCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Confirm Hide Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={!!confirmHide}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmHide(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setConfirmHide(null)}
        >
          <TouchableOpacity style={styles.contextMenu} activeOpacity={1}>
            <Title style={styles.contextTitle}>非表示にしますか？</Title>
            <Muted style={styles.confirmMsg}>
              「{confirmHide?.name}」を非表示にします。{'\n'}
              アレルギー警告は引き続き機能します。
            </Muted>
            <Button
              onPress={() => confirmHide && hideItem(confirmHide.category, confirmHide.name)}
              style={[styles.contextBtn, { backgroundColor: GRAY_700, borderColor: GRAY_700 }]}
            >
              <EyeOff size={16} color="#FFFFFF" />
              <Text style={styles.contextBtnTextLight}>非表示にする</Text>
            </Button>
            <TouchableOpacity
              style={styles.contextCancelBtn}
              onPress={() => setConfirmHide(null)}
            >
              <Text style={styles.contextCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Add Custom Food Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddModal(false)}
        >
          <TouchableOpacity style={styles.sheetContainer} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>カスタム食材を追加</Title>
            <Muted style={styles.modalLabel}>食材名</Muted>
            <TextInput
              style={styles.textInput}
              placeholder="食材名を入力"
              placeholderTextColor={GRAY_400}
              value={customName}
              onChangeText={setCustomName}
              maxLength={30}
              autoFocus
            />
            <Muted style={styles.modalLabel}>カテゴリ</Muted>
            <View style={styles.categoryGrid}>
              {FOOD_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPickChip, customCategory === cat.id && styles.catPickChipActive]}
                  onPress={() => setCustomCategory(cat.id)}
                >
                  <Text style={[styles.catPickText, customCategory === cat.id && styles.catPickTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <Button variant="outline" onPress={() => setShowAddModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </Button>
              <Button
                onPress={addCustomFood}
                disabled={!customName.trim()}
                style={[styles.saveBtn, { flex: 1 }, !customName.trim() && styles.saveBtnDisabled]}
              >
                <Text style={styles.saveBtnText}>追加する</Text>
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Custom Food Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={editCustomOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditCustomOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setEditCustomOpen(false)}
        >
          <TouchableOpacity style={styles.sheetContainer} activeOpacity={1}>
            <View style={styles.sheetHandle} />
            <Title style={styles.sheetTitle}>食材を編集</Title>
            <Muted style={styles.modalLabel}>食材名</Muted>
            <TextInput
              style={styles.textInput}
              placeholder="食材名を入力"
              placeholderTextColor={GRAY_400}
              value={editCustomName}
              onChangeText={setEditCustomName}
              maxLength={30}
            />
            <Muted style={styles.modalLabel}>カテゴリ</Muted>
            <View style={styles.categoryGrid}>
              {FOOD_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catPickChip, editCustomCategory === cat.id && styles.catPickChipActive]}
                  onPress={() => setEditCustomCategory(cat.id)}
                >
                  <Text style={[styles.catPickText, editCustomCategory === cat.id && styles.catPickTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <Button variant="outline" onPress={() => setEditCustomOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>キャンセル</Text>
              </Button>
              <Button
                onPress={submitEditCustom}
                disabled={!editCustomName.trim() || updateMutation.isPending}
                style={[styles.saveBtn, { flex: 1 }, (!editCustomName.trim() || updateMutation.isPending) && styles.saveBtnDisabled]}
              >
                <Text style={styles.saveBtnText}>保存する</Text>
              </Button>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Confirm Delete Custom Food Modal ───────────────────────────────────── */}
      <Modal
        visible={!!confirmDeleteCustom}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteCustom(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setConfirmDeleteCustom(null)}
        >
          <TouchableOpacity style={styles.contextMenu} activeOpacity={1}>
            <Title style={styles.contextTitle}>削除しますか？</Title>
            <Muted style={styles.confirmMsg}>
              「{confirmDeleteCustom?.name}」を削除します。{'\n'}
              この操作は元に戻せません。
            </Muted>
            <Button
              onPress={() => {
                if (!confirmDeleteCustom) return;
                deleteMutation.mutate(confirmDeleteCustom.id, {
                  onSuccess: () => setConfirmDeleteCustom(null),
                });
              }}
              disabled={deleteMutation.isPending}
              style={[styles.contextBtn, { backgroundColor: RED_500, borderColor: RED_500 }]}
            >
              <Trash2 size={16} color="#FFFFFF" />
              <Text style={styles.contextBtnTextLight}>削除する</Text>
            </Button>
            <TouchableOpacity
              style={styles.contextCancelBtn}
              onPress={() => setConfirmDeleteCustom(null)}
            >
              <Text style={styles.contextCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scrollContent: { padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, padding: 16 },
  emptyCard: { padding: 24, borderRadius: 24, alignItems: 'center' },
  centeredText: { fontSize: 15, color: GRAY_500, fontFamily: fonts.bodyBold },

  // Title
  pageTitle: { fontSize: 22, color: palette.foreground, marginBottom: 2 },
  childName: { fontSize: 14, color: PURPLE, fontFamily: fonts.bodyBold, marginBottom: 12 },

  // Progress
  progressCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 0,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontFamily: fonts.bodyBold, color: GRAY_700 },
  progressValue: { fontSize: 13, fontFamily: fonts.bodyBold, color: PURPLE_600 },
  progressBarBg: { height: 12, borderRadius: 6, backgroundColor: GRAY_100, overflow: 'hidden' },
  progressBarFill: { height: 12, borderRadius: 6, backgroundColor: PURPLE },
  progressLegend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendGreen: { fontSize: 12, fontFamily: fonts.bodyBold, color: STATUS_GREEN_TEXT },
  legendOrange: { fontSize: 12, fontFamily: fonts.bodyBold, color: STATUS_ORANGE },

  // Search
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'stretch' },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: GRAY_200,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: palette.foreground, fontFamily: fonts.body, paddingVertical: 10 },
  addHeaderBtn: {
    alignSelf: 'stretch',
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  addHeaderBtnText: { color: palette.primaryForeground, fontSize: 12, fontFamily: fonts.bodyBold },

  // Category tabs
  categoryScroll: { marginBottom: 12 },
  categoryScrollContent: { gap: 6, paddingRight: 4 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: palette.card,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: GRAY_200,
  },
  categoryChipActive: { backgroundColor: PURPLE, borderColor: PURPLE },
  categoryText: { fontSize: 12, color: GRAY_500, fontFamily: fonts.bodyBold },
  categoryTextActive: { color: palette.primaryForeground },

  // Category sections
  categorySection: {
    overflow: 'hidden',
    marginBottom: 16,
    padding: 0,
    borderRadius: 24,
    borderWidth: 0,
  },
  categoryHeader: { backgroundColor: PURPLE_50, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: PURPLE_100 },
  categoryHeaderText: { fontSize: 13, fontFamily: fonts.bodyBold, color: PURPLE_700 },
  hiddenCategoryHeader: { backgroundColor: GRAY_50, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: GRAY_100, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hiddenCategoryHeaderText: { fontSize: 13, fontFamily: fonts.bodyBold, color: GRAY_400 },
  foodGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  foodCard: {
    width: '47.5%',
    borderRadius: radius.lg,
    padding: 10,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
  },
  foodIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodTextWrap: { flex: 1, minWidth: 0 },
  foodName: { fontSize: 12, fontFamily: fonts.bodyBold },
  foodDate: { fontSize: 10, color: GRAY_400, fontFamily: fonts.bodySemibold },

  // Hidden section
  hiddenSection: { marginBottom: 16 },
  hiddenToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: GRAY_200,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    backgroundColor: palette.card,
    paddingVertical: 12,
  },
  hiddenToggleText: { fontSize: 12, color: GRAY_400, fontFamily: fonts.bodyBold },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glow,
  },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  // Bottom sheet
  sheetContainer: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 10,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: GRAY_200,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, color: palette.foreground, textAlign: 'center', marginBottom: 4 },

  // Status options
  statusOption: {
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: GRAY_200,
    backgroundColor: palette.card,
  },
  statusOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusOptionGrayActive: { backgroundColor: GRAY_50, borderColor: GRAY_400, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusOptionGreenActive: { backgroundColor: STATUS_GREEN_BG, borderColor: STATUS_GREEN },
  statusOptionOrangeActive: { backgroundColor: STATUS_ORANGE_BG, borderColor: STATUS_ORANGE },
  statusOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOptionTitle: { fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },
  statusOptionSub: { fontSize: 11, color: GRAY_400, marginTop: 2 },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: GRAY_200,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  dateInput: { flex: 1, fontSize: 14, fontFamily: fonts.bodyBold, color: GRAY_700 },

  // Note input
  noteInput: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: STATUS_ORANGE_BORDER,
    padding: 12,
    fontSize: 14,
    fontFamily: fonts.body,
    color: palette.foreground,
    minHeight: 72,
  },

  // Save button
  saveBtn: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
    borderRadius: radius.lg,
    minHeight: 52,
    marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: GRAY_200, borderColor: GRAY_200 },
  saveBtnText: { color: palette.primaryForeground, fontSize: 16, fontFamily: fonts.bodyBold },

  // Context menu
  contextMenu: {
    backgroundColor: palette.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 20,
    gap: 10,
  },
  contextTitle: { fontSize: 16, color: palette.foreground, textAlign: 'center', marginBottom: 4 },
  confirmMsg: { fontSize: 13, color: GRAY_500, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  contextBtn: { borderRadius: radius.lg, minHeight: 50, backgroundColor: PURPLE, borderColor: PURPLE },
  contextBtnTextLight: { fontSize: 15, fontFamily: fonts.bodyBold, color: palette.primaryForeground },
  contextBtnTextDark: { fontSize: 15, fontFamily: fonts.bodyBold, color: palette.foreground },
  contextCancelBtn: { padding: 10, alignItems: 'center' },
  contextCancelText: { fontSize: 14, color: GRAY_400, fontFamily: fonts.bodyBold },

  // Add custom food modal
  textInput: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.body,
    borderWidth: 2,
    borderColor: GRAY_200,
    color: palette.foreground,
  },
  modalLabel: { fontSize: 12, color: GRAY_500, fontFamily: fonts.bodyBold },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catPickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: GRAY_200,
    backgroundColor: palette.card,
  },
  catPickChipActive: { backgroundColor: PURPLE_50, borderColor: PURPLE_300 },
  catPickText: { fontSize: 12, color: GRAY_500, fontFamily: fonts.bodyBold },
  catPickTextActive: { color: PURPLE_600 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, borderRadius: radius.lg, minHeight: 50, borderColor: GRAY_200 },
  cancelText: { color: palette.foreground, fontSize: 15, fontFamily: fonts.bodySemibold },
});
