import { memo } from 'react';
import { FRONT_BUILDING_LINE, FRONT_EASEMENT_DEPTH, LOT_DEPTH, LOT_WIDTH } from '../data/property';
import { PlanText } from './PlanObjects';

/**
 * The record survey drawn as the base sheet: property lines, the recorded
 * building line and utility easement, the street, and the sheet furniture
 * (north arrow, graphic scale) a plan is expected to carry.
 */
export const SurveyBase = memo(function SurveyBase({ scale }: { scale: number }) {
  const W = LOT_WIDTH;
  const D = LOT_DEPTH;

  return (
    <g>
      {/* Street right-of-way */}
      <rect x={-14} y={-26} width={W + 28} height={26} fill="#e6e3dc" />
      <line x1={-14} y1={-13} x2={W + 14} y2={-13} stroke="#fff" strokeWidth={2.5} strokeDasharray="10 8" vectorEffect="non-scaling-stroke" opacity={0.85} />
      <line x1={-14} y1={0} x2={W + 14} y2={0} stroke="#b9b4a9" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {scale > 3 && (
        <PlanText x={W / 2} y={-19} scale={scale} px={13} fill="#7a736a" weight={700} anchor="middle">
          CREEKSTONE COURT — 50′ R.O.W.
        </PlanText>
      )}

      {/* Adjoining lots, for context */}
      {scale > 2.5 && (
        <>
          <PlanText x={-8} y={D * 0.55} scale={scale} px={11} fill="#a9a296" weight={600}>LOT 40</PlanText>
          <PlanText x={W + 8} y={D * 0.55} scale={scale} px={11} fill="#a9a296" weight={600}>LOT 42</PlanText>
          <PlanText x={W / 2} y={D + 8} scale={scale} px={11} fill="#a9a296" weight={600}>LOT 50</PlanText>
        </>
      )}

      {/* The lot itself */}
      <rect
        x={0}
        y={0}
        width={W}
        height={D}
        fill="#f4f2ec"
        stroke="#c0392b"
        strokeWidth={2.4}
        vectorEffect="non-scaling-stroke"
      />

      {/* 10' T.P.& L. easement across the frontage */}
      <rect x={0} y={0} width={W} height={FRONT_EASEMENT_DEPTH} fill="#d9a441" fillOpacity={0.1} />
      <line
        x1={0}
        y1={FRONT_EASEMENT_DEPTH}
        x2={W}
        y2={FRONT_EASEMENT_DEPTH}
        stroke="#c9962c"
        strokeWidth={1.4}
        strokeDasharray="9 5"
        vectorEffect="non-scaling-stroke"
      />

      {/* 25' front building line */}
      <line
        x1={0}
        y1={FRONT_BUILDING_LINE}
        x2={W}
        y2={FRONT_BUILDING_LINE}
        stroke="#c0392b"
        strokeWidth={1.4}
        strokeDasharray="16 6 3 6"
        vectorEffect="non-scaling-stroke"
        opacity={0.75}
      />

      {scale > 3.2 && (
        <>
          <PlanText x={7.5} y={FRONT_EASEMENT_DEPTH - 2.4} scale={scale} px={10} fill="#a3781f" weight={600} anchor="start" halo>
            10′ T.P.&amp; L. ESMT.
          </PlanText>
          <PlanText x={2} y={FRONT_BUILDING_LINE + 2.2} scale={scale} px={10} fill="#9e3427" weight={600} anchor="start" halo>
            25′ BL
          </PlanText>
        </>
      )}

      {/* Boundary dimension strings */}
      {scale > 2.5 && (
        <>
          <BoundaryDim x1={0} y1={-4.5} x2={W} y2={-4.5} label="WEST  70.00′" scale={scale} />
          <BoundaryDim x1={W + 5} y1={0} x2={W + 5} y2={D} label="SOUTH  120.00′" scale={scale} vertical />
          <BoundaryDim x1={-5} y1={0} x2={-5} y2={D} label="NORTH  120.00′" scale={scale} vertical />
          <BoundaryDim x1={0} y1={D + 4.5} x2={W} y2={D + 4.5} label="EAST  70.00′" scale={scale} />
        </>
      )}

      {/* Corner monuments */}
      {[
        [0, 0],
        [W, 0],
        [0, D],
        [W, D],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={Math.max(0.5, 4 / scale)} fill="#fff" stroke="#2f6fb0" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
});

function BoundaryDim({
  x1,
  y1,
  x2,
  y2,
  label,
  scale,
  vertical = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  scale: number;
  vertical?: boolean;
}) {
  const tick = Math.max(0.6, 5 / scale);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8f887d" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {[
        [x1, y1],
        [x2, y2],
      ].map(([x, y], i) => (
        <line
          key={i}
          x1={vertical ? x - tick : x}
          y1={vertical ? y : y - tick}
          x2={vertical ? x + tick : x}
          y2={vertical ? y : y + tick}
          stroke="#8f887d"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <g transform={vertical ? `rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2})` : undefined}>
        <PlanText
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          scale={scale}
          px={11}
          fill="#5d564c"
          weight={700}
          halo
        >
          {label}
        </PlanText>
      </g>
    </g>
  );
}

/** North arrow and graphic scale, drawn in screen space so they never shrink. */
export function SheetFurniture({ width, height, scale }: { width: number; height: number; scale: number }) {
  // Pick a round graphic-scale length that lands near 130px.
  const candidates = [5, 10, 20, 30, 50, 100];
  const feet = candidates.reduce((best, c) =>
    Math.abs(c * scale - 130) < Math.abs(best * scale - 130) ? c : best,
  );
  const px = feet * scale;
  const x = 22;
  const y = height - 34;

  return (
    <g pointerEvents="none">
      {/* North arrow */}
      <g transform={`translate(${width - 52} 52)`}>
        <circle r={26} fill="#fbfaf7" fillOpacity={0.92} stroke="#cfc9bd" strokeWidth={1} />
        <path d="M 0 -20 L 6.5 8 L 0 3 L -6.5 8 Z" fill="#2f2c27" />
        <path d="M 0 -20 L -6.5 8 L 0 3 Z" fill="#8a8378" />
        <text x={0} y={-24} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2f2c27" fontFamily="'Inter', system-ui, sans-serif">
          N
        </text>
      </g>

      {/* Graphic scale */}
      <g transform={`translate(${x} ${y})`}>
        <rect x={-8} y={-24} width={px + 62} height={40} rx={5} fill="#fbfaf7" fillOpacity={0.92} stroke="#cfc9bd" strokeWidth={1} />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={(px / 4) * i}
            y={-8}
            width={px / 4}
            height={7}
            fill={i % 2 ? '#fbfaf7' : '#2f2c27'}
            stroke="#2f2c27"
            strokeWidth={0.8}
          />
        ))}
        <text x={0} y={-12} fontSize={9.5} fill="#5d564c" fontFamily="'Inter', system-ui, sans-serif">0</text>
        <text x={px} y={-12} textAnchor="middle" fontSize={9.5} fill="#5d564c" fontFamily="'Inter', system-ui, sans-serif">
          {feet}′
        </text>
        <text x={px + 10} y={0} fontSize={10} fontWeight={600} fill="#2f2c27" fontFamily="'Inter', system-ui, sans-serif">
          1″ = {(96 / scale).toFixed(0)}′
        </text>
      </g>
    </g>
  );
}
