/**
 * ScrollTimePicker — RN port of web's ScrollWheelPicker.tsx (ScrollTimePicker).
 * Wheel-style hour/minute columns (minutes in 5-min steps) so times can be
 * picked by scrolling instead of typed as HH:MM text (client feedback
 * 2026-09-09: "時間も手動で入れないといけないのが手間、ウェブ版と同じ選ぶだけが良い").
 *
 * value: "HH:MM" (empty string is treated as 00:00 — callers should seed
 * with the current time before showing the picker).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../theme/ui';

const ITEM_H = 40;
const VISIBLE = 3;
const PAD = Math.floor(VISIBLE / 2) * ITEM_H;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => String(m).padStart(2, '0'));

function timeToIndices(timeStr: string) {
  const [hRaw, mRaw] = (timeStr || '00:00').split(':').map(Number);
  const h = Math.max(0, Math.min(23, hRaw || 0));
  const mSnap = (Math.round((mRaw || 0) / 5) * 5) % 60;
  const mIdx = MINUTES.indexOf(String(mSnap).padStart(2, '0'));
  return { hIdx: h, mIdx: mIdx >= 0 ? mIdx : 0 };
}

/** Round a Date to the nearest 5 minutes and format as HH:MM (picker seed). */
export function nowHHMM(): string {
  const d = new Date();
  const m = Math.round(d.getMinutes() / 5) * 5;
  const h = (d.getHours() + (m === 60 ? 1 : 0)) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function WheelColumn({
  items,
  selectedIdx,
  onSelect,
}: {
  items: string[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const lastReported = useRef(selectedIdx);

  useEffect(() => {
    // Keep the wheel in sync when the value changes externally.
    if (lastReported.current !== selectedIdx) {
      lastReported.current = selectedIdx;
      scrollRef.current?.scrollTo({ y: selectedIdx * ITEM_H, animated: true });
    }
  }, [selectedIdx]);

  const report = useCallback(
    (y: number) => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM_H)));
      if (idx !== lastReported.current) {
        lastReported.current = idx;
        onSelect(idx);
      }
    },
    [items.length, onSelect],
  );

  return (
    <View style={{ flex: 1, height: VISIBLE * ITEM_H, overflow: 'hidden' }}>
      {/* selection band */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 4, right: 4, top: PAD, height: ITEM_H,
          backgroundColor: '#F3F4F6', borderRadius: 12, zIndex: 0,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIdx * ITEM_H }}
        onMomentumScrollEnd={(e) => report(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => report(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingTop: PAD, paddingBottom: PAD }}
        nestedScrollEnabled
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => {
              lastReported.current = i;
              scrollRef.current?.scrollTo({ y: i * ITEM_H, animated: true });
              onSelect(i);
            }}
          >
            <Text
              style={{
                fontSize: i === selectedIdx ? 22 : 16,
                fontWeight: i === selectedIdx ? '900' : '400',
                color: i === selectedIdx ? '#111827' : '#9CA3AF',
              }}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ScrollTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { hIdx, mIdx } = timeToIndices(value);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: VISIBLE * ITEM_H }}>
      <WheelColumn
        items={HOURS}
        selectedIdx={hIdx}
        onSelect={(i) => onChange(`${HOURS[i]}:${MINUTES[timeToIndices(value).mIdx]}`)}
      />
      <Text style={{ fontSize: 22, fontWeight: '900', color: '#9CA3AF' }}>:</Text>
      <WheelColumn
        items={MINUTES}
        selectedIdx={mIdx}
        onSelect={(i) => onChange(`${HOURS[timeToIndices(value).hIdx]}:${MINUTES[i]}`)}
      />
    </View>
  );
}
