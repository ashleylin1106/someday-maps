// Home screen.
//  • List: drill-down — continent cards → country cards → that country's places
//    (grouped by city). No more one giant tree.
//  • Search: find any saved place by name / category / city / country / note.
//  • Multi-select: long-press a place to start selecting, delete many at once.
//  • Routes: itineraries grouped by trip. • Map: pins + matcha route toggle.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
  ActivityIndicator,
  Keyboard,
  Animated,
  PanResponder,
} from 'react-native';
import { Text, TextInput } from './Themed';
import { useStore } from './store';
import {
  Place,
  PlaceStatus,
  PlaceType,
  STATUS_ORDER,
  STATUS_LABELS,
  STATUS_COLORS,
  TYPE_ORDER,
  TYPE_LABELS,
  TYPE_EMOJI,
} from './types';
import { continentOf } from './geo';
import { geocode } from './geocode';
import { distanceMeters } from './distance';
import { PlaceCard } from './components/PlaceCard';
import { PlaceForm } from './components/PlaceForm';
import { PlaceDetail } from './components/PlaceDetail';
import { PasteImport } from './components/PasteImport';
import { MapPlaces } from './components/MapPlaces';
import { AccountModal } from './components/AccountModal';
import { exportPlacesCsv } from './export';
import { colors, radius, spacing } from './theme';

type StatusFilter = 'all' | PlaceStatus;
type ViewMode = 'list' | 'routes' | 'map';

interface Group {
  name: string;
  places: Place[];
  max: number;
}
type RouteRow =
  | { kind: 'trip'; key: string; label: string; count: number; expanded: boolean; places: Place[] }
  | { kind: 'place'; key: string; place: Place };

const maxUpd = (ps: Place[]) => ps.reduce((m, p) => Math.max(m, p.updatedAt), 0);
function byRecency(a: Group, b: Group): number {
  const aLast = a.name === 'Other' || a.name === 'Uncategorized';
  const bLast = b.name === 'Other' || b.name === 'Uncategorized';
  if (aLast && !bLast) return 1;
  if (bLast && !aLast) return -1;
  return b.max - a.max;
}
const contOf = (p: Place) => {
  const country = p.country || 'Uncategorized';
  return country === 'Uncategorized' ? 'Other' : continentOf(country);
};

export function HomeScreen() {
  const { places, loading, addPlace, updatePlace, deletePlace, deletePlaces, setCoords, userId } =
    useStore();
  const [accountOpen, setAccountOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeSet, setTypeSet] = useState<Set<PlaceType>>(new Set());
  const [view, setView] = useState<ViewMode>('list');
  const [navContinent, setNavContinent] = useState<string | null>(null);
  const [navCountry, setNavCountry] = useState<string | null>(null);
  const [navCity, setNavCity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [openTrips, setOpenTrips] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [exporting, setExporting] = useState(false);

  // IG-style collapsing header: scrolling down snaps the whole top bar away,
  // any upward scroll snaps it back. Direction-based (not offset-based) so
  // iOS rubber-band bouncing can't leave it stuck halfway.
  const [headerHeight, setHeaderHeight] = useState(300);
  const headerShown = useRef(new Animated.Value(1)).current; // 1 = shown, 0 = hidden
  const headerShownState = useRef(true);
  const lastScrollY = useRef(0);
  const setHeaderVisible = (show: boolean) => {
    if (headerShownState.current === show) return;
    headerShownState.current = show;
    Animated.timing(headerShown, {
      toValue: show ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };
  const onListScroll = (e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 20) {
      setHeaderVisible(true); // at (or bouncing past) the top → always show
      return;
    }
    if (dy > 6) setHeaderVisible(false);
    else if (dy < -6) setHeaderVisible(true);
  };
  const headerTranslate = useMemo(
    () =>
      headerShown.interpolate({
        inputRange: [0, 1],
        outputRange: [-headerHeight, 0],
      }),
    [headerShown, headerHeight]
  );
  // Reveal the header again whenever the context changes.
  useEffect(() => {
    lastScrollY.current = 0;
    setHeaderVisible(true);
  }, [view, navContinent, navCountry, navCity, query, searchFocused]);

  // Repair stacked coordinates: some imports gave several places the SAME
  // approximate coords (city center), piling their pins on one spot. For any
  // group sharing near-identical coords, re-geocode each from its street
  // address so pins land where the places actually are.
  const fixAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading) return;
    const byKey = new Map<string, Place[]>();
    for (const p of places) {
      if (p.lat == null || p.lng == null) continue;
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`; // ~11 m buckets
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p);
    }
    (async () => {
      for (const group of byKey.values()) {
        if (group.length < 2) continue;
        for (const p of group) {
          if (!p.address || fixAttempted.current.has(p.id)) continue;
          fixAttempted.current.add(p.id);
          const g = await geocode([p.address, p.city, p.country].filter(Boolean).join(', '));
          if (g && distanceMeters(g.lat, g.lng, p.lat as number, p.lng as number) > 25) {
            setCoords(p.id, g.lat, g.lng);
          }
        }
      }
    })();
  }, [loading, places, setCoords]);

  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (statusFilter === 'all' || p.status === statusFilter) &&
          (typeSet.size === 0 || typeSet.has(p.type))
      ),
    [places, statusFilter, typeSet]
  );
  const scattered = useMemo(() => filtered.filter((p) => !p.trip), [filtered]);
  const routed = useMemo(() => filtered.filter((p) => p.trip), [filtered]);

  // --- search (across everything, flat results) ---
  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return filtered
      .filter((p) =>
        [p.name, p.category, p.city, p.country, p.note, p.trip].some((v) =>
          (v || '').toLowerCase().includes(q)
        )
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filtered, query]);

  // Latest additions — shown when the search bar is focused (Google Maps-style).
  const recent = useMemo(
    () => [...scattered].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
    [scattered]
  );

  // --- drill-down groups ---
  const continentGroups = useMemo<Group[]>(() => {
    const m = new Map<string, Place[]>();
    for (const p of scattered) {
      const k = contOf(p);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries())
      .map(([name, ps]) => ({ name, places: ps, max: maxUpd(ps) }))
      .sort(byRecency);
  }, [scattered]);

  const countryGroups = useMemo<Group[]>(() => {
    if (!navContinent) return [];
    const m = new Map<string, Place[]>();
    for (const p of scattered) {
      if (contOf(p) !== navContinent) continue;
      const k = p.country || 'Uncategorized';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries())
      .map(([name, ps]) => ({ name, places: ps, max: maxUpd(ps) }))
      .sort(byRecency);
  }, [scattered, navContinent]);

  // City cards inside a country (so countries with many cities stay browsable).
  const cityGroups = useMemo<Group[]>(() => {
    if (!navCountry) return [];
    const m = new Map<string, Place[]>();
    for (const p of scattered) {
      if ((p.country || 'Uncategorized') !== navCountry) continue;
      const k = p.city || 'Other';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return Array.from(m.entries())
      .map(([name, ps]) => ({ name, places: ps, max: maxUpd(ps) }))
      .sort(byRecency);
  }, [scattered, navCountry]);

  // The places of the opened city, most recently edited first.
  const cityPlaces = useMemo<Place[]>(() => {
    if (!navCountry || !navCity) return [];
    return scattered
      .filter(
        (p) => (p.country || 'Uncategorized') === navCountry && (p.city || 'Other') === navCity
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [scattered, navCountry, navCity]);

  // --- routes rows ---
  const routeRows = useMemo<RouteRow[]>(() => {
    const byTrip = new Map<string, Place[]>();
    for (const p of routed) {
      if (!byTrip.has(p.trip)) byTrip.set(p.trip, []);
      byTrip.get(p.trip)!.push(p);
    }
    const trips = Array.from(byTrip.entries())
      .map(([trip, ps]) => ({ name: trip, places: ps, max: maxUpd(ps) }))
      .sort(byRecency);
    const out: RouteRow[] = [];
    for (const t of trips) {
      const open = openTrips.has(t.name);
      out.push({
        kind: 'trip',
        key: `trip:${t.name}`,
        label: t.name,
        count: t.places.length,
        expanded: open,
        places: t.places,
      });
      if (!open) continue;
      const ordered = [...t.places].sort(
        (a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name)
      );
      for (const p of ordered) out.push({ kind: 'place', key: `rp:${p.id}`, place: p });
    }
    return out;
  }, [routed, openTrips]);

  // --- selection ---
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const startSelect = (id: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  };
  const cancelSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  // Group selection: regions / cities / routes join the same multi-select as
  // places — long-press selects the whole group, tap toggles it.
  const groupSelected = (ps: Place[]) =>
    ps.length > 0 && ps.every((p) => selectedIds.has(p.id));
  const toggleGroup = (ps: Place[]) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const all = ps.every((p) => next.has(p.id));
      ps.forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  const startSelectGroup = (ps: Place[]) => {
    setSelectMode(true);
    setSelectedIds(new Set(ps.map((p) => p.id)));
  };

  const deleteSelected = () => {
    const n = selectedIds.size;
    if (n === 0) return;
    Alert.alert('Delete places', `Delete ${n} place${n === 1 ? '' : 's'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePlaces([...selectedIds]);
          cancelSelect();
        },
      },
    ]);
  };

  const placeCard = (p: Place) => (
    <PlaceCard
      place={p}
      selectMode={selectMode}
      selected={selectedIds.has(p.id)}
      onPress={() => (selectMode ? toggleSelect(p.id) : openDetail(p))}
      onLongPress={() => (selectMode ? toggleSelect(p.id) : startSelect(p.id))}
    />
  );

  const openDetail = (p: Place) => {
    setSelected(p);
    setDetailOpen(true);
  };
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const goBack = () => {
    if (navCity) setNavCity(null);
    else if (navCountry) setNavCountry(null);
    else setNavContinent(null);
  };

  // Swipe right anywhere on the content to go back one level (like iOS).
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderRelease: (_e, g) => {
        if (g.dx > 60) goBackRef.current();
      },
    })
  ).current;
  const canSwipeBack = view === 'list' && !searching && !!navContinent;

  const handleExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'This filter is empty right now');
      return;
    }
    try {
      setExporting(true);
      await exportPlacesCsv(filtered);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  };

  const statusChips: { value: StatusFilter; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: '#1C1C1E' },
    ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s], color: STATUS_COLORS[s] })),
  ];

  const subtitle =
    view === 'routes'
      ? `${routed.length} route stops`
      : `${scattered.length} places · ${new Set(scattered.map((p) => p.country || 'Uncategorized')).size} countries`;

  // --- renderers ---
  const renderGridCard = (g: Group, onPress: () => void, big: boolean) => {
    const sel = selectMode && groupSelected(g.places);
    return (
      <Pressable
        style={[styles.gridCard, big && styles.gridCardBig, sel && styles.gridCardSelected]}
        onPress={() => (selectMode ? toggleGroup(g.places) : onPress())}
        onLongPress={() => (selectMode ? toggleGroup(g.places) : startSelectGroup(g.places))}
        delayLongPress={400}
      >
        <Text style={styles.gridName} numberOfLines={2}>
          {g.name}
        </Text>
        <Text style={styles.gridCount}>
          {g.places.length} place{g.places.length === 1 ? '' : 's'}
        </Text>
      </Pressable>
    );
  };


  const renderRouteRow = ({ item }: { item: RouteRow }) => {
    if (item.kind === 'trip') {
      const sel = selectMode && groupSelected(item.places);
      return (
        <Pressable
          style={styles.tripRow}
          onPress={() =>
            selectMode
              ? toggleGroup(item.places)
              : setOpenTrips((prev) => {
                  const next = new Set(prev);
                  next.has(item.label) ? next.delete(item.label) : next.add(item.label);
                  return next;
                })
          }
          onLongPress={() => (selectMode ? toggleGroup(item.places) : startSelectGroup(item.places))}
          delayLongPress={400}
        >
          <Text style={styles.chevron}>{item.expanded ? '▾' : '▸'}</Text>
          <Text style={[styles.tripName, sel && { color: colors.accent }]}>
            {sel ? '✓ ' : ''}🧭 {item.label}
          </Text>
          <Text style={styles.count}>{item.count}</Text>
        </Pressable>
      );
    }
    return <View style={styles.placeWrap}>{placeCard(item.place)}</View>;
  };

  // Shared props so every list scrolls under the collapsing header.
  const listPad = [styles.listContent, { paddingTop: headerHeight + 8 }];
  const scrollProps = {
    onScroll: onListScroll,
    scrollEventThrottle: 16,
  } as const;
  const topPad = { paddingTop: headerHeight };

  const listBody = () => {
    if (searching) {
      return searchResults.length === 0 ? (
        <View style={[styles.center, topPad]}>
          <Text style={styles.emptyBig}>No matches</Text>
          <Text style={styles.emptySmall}>Nothing saved matches “{query.trim()}”</Text>
        </View>
      ) : (
        <Animated.FlatList
          {...scrollProps}
          data={searchResults}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <View style={styles.searchItem}>{placeCard(item)}</View>}
          contentContainerStyle={listPad}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      );
    }
    // Search bar focused but nothing typed yet → show recents (Google Maps-style).
    if (searchFocused) {
      return (
        <Animated.FlatList
          {...scrollProps}
          data={recent}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <View style={styles.searchItem}>{placeCard(item)}</View>}
          contentContainerStyle={listPad}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={<Text style={styles.recentTitle}>🕐 Recently saved</Text>}
          ListEmptyComponent={
            <Text style={styles.emptySmall}>Nothing saved yet — paste something with 📋</Text>
          }
        />
      );
    }
    if (navCity) {
      return (
        <Animated.FlatList
          {...scrollProps}
          data={cityPlaces}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <View style={styles.placeWrap}>{placeCard(item)}</View>}
          contentContainerStyle={listPad}
        />
      );
    }
    if (navCountry) {
      return (
        <Animated.FlatList
          {...scrollProps}
          data={cityGroups}
          key="cities"
          keyExtractor={(g) => g.name}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => renderGridCard(item, () => setNavCity(item.name), false)}
          contentContainerStyle={listPad}
        />
      );
    }
    if (navContinent) {
      return (
        <Animated.FlatList
          {...scrollProps}
          data={countryGroups}
          key="countries"
          keyExtractor={(g) => g.name}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => renderGridCard(item, () => setNavCountry(item.name), false)}
          contentContainerStyle={listPad}
        />
      );
    }
    if (continentGroups.length === 0) {
      return (
        <View style={[styles.center, topPad]}>
          <Text style={styles.emptyBig}>No places here</Text>
          <Text style={styles.emptySmall}>Tap 📋 to paste text, or ＋ to add one</Text>
        </View>
      );
    }
    return (
      <Animated.FlatList
        {...scrollProps}
        data={continentGroups}
        key="continents"
        keyExtractor={(g) => g.name}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => renderGridCard(item, () => setNavContinent(item.name), true)}
        contentContainerStyle={listPad}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
      {/* Content sits under the collapsing header (rendered after it, so the
          header stays on top). Swipe right anywhere here to go back a level. */}
      <View style={styles.content} {...(canSwipeBack ? swipeBack.panHandlers : {})}>
        {loading ? (
          <View style={[styles.center, topPad]}>
            <ActivityIndicator />
          </View>
        ) : view === 'map' ? (
          <View style={[styles.content, topPad]}>
            <MapPlaces places={scattered} routePlaces={routed} onSelect={openDetail} />
          </View>
        ) : view === 'routes' ? (
          routeRows.length === 0 ? (
            <View style={[styles.center, topPad]}>
              <Text style={styles.emptyBig}>No routes yet</Text>
              <Text style={styles.emptySmall}>
                Paste an itinerary or blog link, then choose “🧭 One route”.
              </Text>
            </View>
          ) : (
            <Animated.FlatList
              {...scrollProps}
              data={routeRows}
              keyExtractor={(r) => r.key}
              renderItem={renderRouteRow}
              contentContainerStyle={listPad}
            />
          )
        ) : (
          listBody()
        )}
      </View>

      {/* Collapsing header — slides away as you scroll down, returns on scroll up */}
      <Animated.View
        style={[styles.headerWrap, { transform: [{ translateY: headerTranslate }] }]}
        onLayout={(e) => setHeaderHeight(Math.round(e.nativeEvent.layout.height))}
      >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Someday Maps</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Pressable style={styles.accountBtn} onPress={() => setAccountOpen(true)} hitSlop={6}>
          <Text style={styles.accountBtnText}>{userId ? '☁️' : '👤'}</Text>
        </Pressable>
        <Pressable
          style={[styles.exportBtn, exporting && { opacity: 0.5 }]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={styles.exportText}>Export CSV</Text>
          )}
        </Pressable>
      </View>

      {/* List / Routes / Map toggle */}
      <View style={styles.viewToggle}>
        {([['list', 'List'], ['routes', 'Routes'], ['map', 'Map']] as [ViewMode, string][]).map(
          ([v, label]) => (
            <Pressable
              key={v}
              style={[styles.viewBtn, view === v && styles.viewBtnActive]}
              onPress={() => setView(v)}
            >
              <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>{label}</Text>
            </Pressable>
          )
        )}
      </View>

      {/* Search (list view). The recents/results panel stays open while you
          scroll — only Cancel closes it (Google Maps behavior). */}
      {view === 'list' && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              placeholder="🔍  Search saved places"
              placeholderTextColor={colors.subtext}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.searchClear}>
                <Text style={styles.searchClearText}>✕</Text>
              </Pressable>
            )}
          </View>
          {(searchFocused || !!query) && (
            <Pressable
              onPress={() => {
                setQuery('');
                setSearchFocused(false);
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <Text style={styles.searchCancel}>Cancel</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        {statusChips.map((f) => {
          const active = f.value === statusFilter;
          const activeText = f.value === 'all' ? '#fff' : '#1C1C1E';
          return (
            <Pressable
              key={f.value}
              onPress={() => setStatusFilter(f.value)}
              style={[styles.chip, active && { backgroundColor: f.color, borderColor: f.color }]}
            >
              <Text style={[styles.chipText, active && { color: activeText, fontWeight: '600' }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Type filter (multi-select) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        <Pressable
          onPress={() => setTypeSet(new Set())}
          style={[styles.chip, typeSet.size === 0 && { backgroundColor: colors.text, borderColor: colors.text }]}
        >
          <Text style={[styles.chipText, typeSet.size === 0 && styles.chipTextActive]}>All types</Text>
        </Pressable>
        {TYPE_ORDER.map((t) => {
          const active = typeSet.has(t);
          return (
            <Pressable
              key={t}
              onPress={() =>
                setTypeSet((prev) => {
                  const next = new Set(prev);
                  next.has(t) ? next.delete(t) : next.add(t);
                  return next;
                })
              }
              style={[styles.chip, active && { backgroundColor: colors.text, borderColor: colors.text }]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {TYPE_EMOJI[t]} {TYPE_LABELS[t]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Breadcrumb / back (drill-down) */}
      {view === 'list' && !searching && navContinent && (
        <Pressable style={styles.backRow} onPress={goBack}>
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>
            {navCity
              ? `${navContinent}  ›  ${navCountry}  ›  `
              : navCountry
                ? `${navContinent}  ›  `
                : ''}
            <Text style={styles.backCurrent}>{navCity ?? navCountry ?? navContinent}</Text>
          </Text>
        </Pressable>
      )}
      </Animated.View>

      {/* Selection action bar */}
      {selectMode ? (
        <View style={styles.selectBar}>
          <Pressable onPress={cancelSelect} hitSlop={8}>
            <Text style={styles.selectCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.selectCount}>{selectedIds.size} selected</Text>
          <Pressable onPress={deleteSelected} hitSlop={8} disabled={selectedIds.size === 0}>
            <Text style={[styles.selectDelete, selectedIds.size === 0 && { opacity: 0.4 }]}>Delete</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <PasteImport />
          <Pressable style={styles.fab} onPress={openAdd}>
            <Text style={styles.fabText}>＋</Text>
          </Pressable>
        </>
      )}
      </View>

      <PlaceDetail
        place={selected}
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        onOpenPlace={(p) => setSelected(p)}
        onEdit={(p) => {
          setDetailOpen(false);
          setEditing(p);
          setFormOpen(true);
        }}
        onDelete={(id) => {
          deletePlace(id);
          setDetailOpen(false);
        }}
      />

      <AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} />

      <PlaceForm
        visible={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSave={(draft) => {
          if (editing) updatePlace(editing.id, draft);
          else addPlace(draft);
          setFormOpen(false);
        }}
        onDelete={(id) => {
          deletePlace(id);
          setFormOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  root: { flex: 1 },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.bg,
    paddingBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.subtext, marginTop: 2 },
  exportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    minWidth: 84,
    alignItems: 'center',
  },
  exportText: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  accountBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountBtnText: { fontSize: 18 },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    backgroundColor: colors.chipBg,
    borderRadius: radius.sm,
    padding: 3,
  },
  viewBtn: { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.sm - 2 },
  viewBtnActive: { backgroundColor: colors.card },
  viewBtnText: { fontSize: 16, color: colors.subtext, fontWeight: '600' },
  viewBtnTextActive: { color: colors.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  searchBox: { flex: 1, position: 'relative', justifyContent: 'center' },
  searchCancel: { fontSize: 16, color: colors.accent, fontWeight: '600' },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    paddingRight: 40,
  },
  searchClear: { position: 'absolute', right: spacing.md },
  searchClearText: { fontSize: 16, color: colors.subtext },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, alignItems: 'center' },
  chip: {
    height: 38,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, lineHeight: 20, color: colors.text, textAlign: 'center' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backChevron: { fontSize: 24, color: colors.accent, fontWeight: '600', marginTop: -2 },
  backText: { fontSize: 17, color: colors.subtext },
  backCurrent: { color: colors.text, fontWeight: '700' },
  content: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 140 },
  gridRow: { gap: spacing.md },
  recentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  gridCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 92,
    justifyContent: 'center',
    gap: 4,
  },
  gridCardBig: { minHeight: 110 },
  gridCardSelected: { borderWidth: 2, borderColor: colors.accent },
  gridName: { fontSize: 21, fontWeight: '700', color: colors.text },
  gridCount: { fontSize: 14, color: colors.subtext },
  placeWrap: { paddingVertical: spacing.xs },
  searchItem: { paddingVertical: spacing.xs },
  tripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chevron: { fontSize: 16, color: colors.subtext, width: 18 },
  tripName: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  count: {
    fontSize: 13,
    color: colors.subtext,
    backgroundColor: colors.chipBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyBig: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySmall: { fontSize: 14, color: colors.subtext, textAlign: 'center', lineHeight: 22 },
  selectBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  selectCancel: { fontSize: 16, color: colors.subtext },
  selectCount: { fontSize: 16, fontWeight: '600', color: colors.text },
  selectDelete: { fontSize: 16, fontWeight: '700', color: colors.danger },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, marginTop: -2 },
});
