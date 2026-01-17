import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';

const STORAGE_KEY = 'bankNetworkPositions';
const ZONE_POSITIONS_KEY = 'bankNetworkZonePositions';

function BankNetworkGraph({ banks, nostros }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const nodePositionsRef = useRef(new Map());
  const zonePositionsRef = useRef(new Map());
  const [resetTrigger, setResetTrigger] = React.useState(0);

  // Cargar posiciones guardadas
  const loadPositions = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const positions = JSON.parse(stored);
        nodePositionsRef.current = new Map(Object.entries(positions));
      }
    } catch (e) {
      console.warn('Failed to load node positions:', e);
    }

    try {
      const storedZones = localStorage.getItem(ZONE_POSITIONS_KEY);
      if (storedZones) {
        const zonePositions = JSON.parse(storedZones);
        zonePositionsRef.current = new Map(Object.entries(zonePositions));
      }
    } catch (e) {
      console.warn('Failed to load zone positions:', e);
    }
  }, []);

  // Guardar posiciones
  const savePositions = useCallback(() => {
    try {
      const positions = Object.fromEntries(nodePositionsRef.current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    } catch (e) {
      console.warn('Failed to save node positions:', e);
    }
  }, []);

  // Guardar posiciones de zonas
  const saveZonePositions = useCallback(() => {
    try {
      const zonePositions = Object.fromEntries(zonePositionsRef.current);
      localStorage.setItem(ZONE_POSITIONS_KEY, JSON.stringify(zonePositions));
    } catch (e) {
      console.warn('Failed to save zone positions:', e);
    }
  }, []);

  // Resetear posiciones
  const resetPositions = useCallback(() => {
    nodePositionsRef.current.clear();
    zonePositionsRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ZONE_POSITIONS_KEY);
    setResetTrigger(prev => prev + 1);
  }, []);

  const { grouped, edges } = useMemo(() => {
    // Agrupar bancos por divisa base
    const banksByBaseCurrency = new Map();
    banks.forEach((bank) => {
      if (!banksByBaseCurrency.has(bank.baseCurrency)) {
        banksByBaseCurrency.set(bank.baseCurrency, []);
      }
      banksByBaseCurrency.get(bank.baseCurrency).push(bank);
    });

    // Ordenar grupos por divisa
    const groupedArray = Array.from(banksByBaseCurrency.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    // Crear mapa de bancos por ID para búsqueda rápida
    const bankById = new Map(banks.map((b) => [b.id, b]));

    // Crear edges desde nostros
    const edgesArray = nostros
      .map((n) => {
        const from = bankById.get(n.ownerBankId);
        const to = bankById.get(n.correspondentBankId);
        if (!from || !to) return null;
        return {
          source: n.ownerBankId,
          target: n.correspondentBankId,
          currency: n.currency,
          fromBank: from,
          toBank: to
        };
      })
      .filter(Boolean);

    return { grouped: groupedArray, edges: edgesArray };
  }, [banks, nostros]);

  useEffect(() => {
    if (!svgRef.current || banks.length === 0) return;

    // Cargar posiciones guardadas al inicio
    loadPositions();

    const width = 800;
    const height = 350;
    const baseGroupRadius = 110; // Radio base para los primeros 3 bancos
    const bankRadius = 15;

    // Función para calcular el radio de la zona según el número de bancos
    function calculateGroupRadius(numBanks) {
      if (numBanks <= 3) {
        return baseGroupRadius;
      }
      // Aumentar proporcionalmente: por cada banco extra, añadir 25 píxeles al radio
      const extraBanks = numBanks - 3;
      return baseGroupRadius + (extraBanks * 25);
    }

    // Limpiar SVG anterior
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Grupo principal con zoom y pan
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Calcular posiciones de los grupos (zonas de divisas)
    const currencyGroups = grouped.map(([currency, banksInGroup], idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, grouped.length);
      const groupRadius = calculateGroupRadius(banksInGroup.length);
      const defaultCx = width / 2 + 160 * Math.cos(angle);
      const defaultCy = height / 2 + 120 * Math.sin(angle);

      // Usar posición guardada si existe
      const savedZonePos = zonePositionsRef.current.get(currency);
      const cx = savedZonePos?.cx ?? defaultCx;
      const cy = savedZonePos?.cy ?? defaultCy;

      return {
        currency,
        cx,
        cy,
        radius: groupRadius,
        banks: banksInGroup
      };
    });

    // Crear nodos de datos con posiciones iniciales o guardadas
    const nodes = [];
    currencyGroups.forEach((group) => {
      group.banks.forEach((bank, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, group.banks.length);
        const defaultX = group.cx + (group.radius - 30) * Math.cos(angle);
        const defaultY = group.cy + (group.radius - 30) * Math.sin(angle);

        // Usar posición guardada si existe, sino usar la posición por defecto
        const savedPos = nodePositionsRef.current.get(bank.id);
        const x = savedPos?.x ?? defaultX;
        const y = savedPos?.y ?? defaultY;

        nodes.push({
          id: bank.id,
          name: bank.name,
          baseCurrency: bank.baseCurrency,
          x,
          y,
          fx: null,
          fy: null,
          groupCx: group.cx,
          groupCy: group.cy,
          groupRadius: group.radius - bankRadius
        });
      });
    });

    // Crear lookup de nodos
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Convertir edges para usar referencias de nodos
    const links = edges.map((e) => ({
      source: nodeById.get(e.source),
      target: nodeById.get(e.target),
      currency: e.currency
    })).filter((link) => link.source && link.target);

    // Dibujar zonas de divisas (círculos punteados)
    const zones = g.append('g').attr('class', 'zones');

    const zoneElements = zones.selectAll('g')
      .data(currencyGroups)
      .join('g')
      .attr('class', 'zone');

    // Círculo de la zona (no arrastrable)
    zoneElements.append('circle')
      .attr('class', 'zone-circle')
      .attr('cx', d => d.cx)
      .attr('cy', d => d.cy)
      .attr('r', d => d.radius)
      .attr('fill', 'none')
      .attr('stroke', '#93a0b5')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '8,4')
      .attr('opacity', 0.6)
      .style('pointer-events', 'none');

    // Área arrastrable central (círculo invisible más grande)
    zoneElements.append('circle')
      .attr('class', 'zone-drag-area')
      .attr('cx', d => d.cx)
      .attr('cy', d => d.cy)
      .attr('r', 35) // Radio del área arrastrable
      .attr('fill', 'rgba(147, 160, 181, 0.1)')
      .attr('stroke', 'none')
      .style('cursor', 'grab');

    // Nombre de la divisa en el centro
    zoneElements.append('text')
      .attr('class', 'zone-label')
      .attr('x', d => d.cx)
      .attr('y', d => d.cy)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#93a0b5')
      .attr('font-size', '18')
      .attr('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => d.currency);

    // Drag behavior para zonas (solo en el área central)
    const zoneDrag = d3.drag()
      .on('start', function(event, d) {
        d3.select(this).style('cursor', 'grabbing');
        // Guardar posición inicial del drag
        d.dragStartX = d.cx;
        d.dragStartY = d.cy;
      })
      .on('drag', function(event, d) {
        // Calcular el desplazamiento
        const dx = event.x - d.cx;
        const dy = event.y - d.cy;

        // Actualizar posición de la zona
        d.cx = event.x;
        d.cy = event.y;

        // Obtener el elemento padre (el grupo de la zona)
        const zoneGroup = d3.select(this.parentNode);

        // Actualizar visual de la zona
        zoneGroup.select('.zone-circle')
          .attr('cx', d.cx)
          .attr('cy', d.cy);

        zoneGroup.select('.zone-drag-area')
          .attr('cx', d.cx)
          .attr('cy', d.cy);

        zoneGroup.select('.zone-label')
          .attr('x', d.cx)
          .attr('y', d.cy);

        // Mover todos los nodos de esta zona
        nodes.forEach(node => {
          if (node.baseCurrency === d.currency) {
            node.x += dx;
            node.y += dy;
            node.groupCx = d.cx;
            node.groupCy = d.cy;

            // Actualizar posición guardada del nodo
            nodePositionsRef.current.set(node.id, { x: node.x, y: node.y });
          }
        });

        updatePositions();
      })
      .on('end', function(event, d) {
        d3.select(this).style('cursor', 'grab');

        // Guardar posición de la zona
        zonePositionsRef.current.set(d.currency, { cx: d.cx, cy: d.cy });
        saveZonePositions();
        savePositions();
      });

    // Aplicar el drag solo al área arrastrable central
    zoneElements.selectAll('.zone-drag-area').call(zoneDrag);

    // Dibujar enlaces (cuentas Nostro/Vostro)
    const linksGroup = g.append('g').attr('class', 'links');

    const linkElements = linksGroup.selectAll('g')
      .data(links)
      .join('g')
      .attr('class', 'link');

    // Líneas
    linkElements.append('line')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)');

    // Etiquetas de divisa cerca del nodo origen (cliente)
    linkElements.append('text')
      .attr('class', 'currency-label')
      .attr('fill', '#3b82f6')
      .attr('font-size', '11')
      .attr('font-weight', '600')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('pointer-events', 'none')
      .text((d) => d.currency);

    // Definir marcador de flecha
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.6);

    // Dibujar nodos (bancos)
    const nodesGroup = g.append('g').attr('class', 'nodes');

    const nodeElements = nodesGroup.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'grab');

    // Círculos de los bancos
    nodeElements.append('circle')
      .attr('r', bankRadius)
      .attr('fill', '#0f172a')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 2);

    // Nombres de los bancos
    nodeElements.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', bankRadius + 14)
      .attr('fill', '#e2e8f0')
      .attr('font-size', '11')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .text((d) => d.name);

    // Función para restringir posición dentro de la zona
    function constrainToZone(node) {
      const dx = node.x - node.groupCx;
      const dy = node.y - node.groupCy;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > node.groupRadius) {
        const angle = Math.atan2(dy, dx);
        node.x = node.groupCx + node.groupRadius * Math.cos(angle);
        node.y = node.groupCy + node.groupRadius * Math.sin(angle);
      }
    }

    // Drag behavior
    const drag = d3.drag()
      .on('start', function(event, d) {
        d3.select(this).style('cursor', 'grabbing');
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        d.x = event.x;
        d.y = event.y;

        // Restringir a la zona
        constrainToZone(d);
        d.fx = d.x;
        d.fy = d.y;

        // Actualizar posiciones
        updatePositions();
      })
      .on('end', function(event, d) {
        d3.select(this).style('cursor', 'grab');

        // Guardar posición al terminar de arrastrar
        nodePositionsRef.current.set(d.id, { x: d.x, y: d.y });
        savePositions();
      });

    nodeElements.call(drag);

    // Función para actualizar posiciones
    function updatePositions() {
      // Actualizar nodos
      nodeElements
        .attr('transform', (d) => `translate(${d.x},${d.y})`);

      // Actualizar enlaces
      linkElements.select('line')
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      // Actualizar etiquetas de divisa (cerca del nodo origen, más alejadas)
      linkElements.select('text')
        .attr('x', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const offset = 40; // Distancia desde el nodo origen (aumentada de 25 a 40)
          return d.source.x + (dx / length) * offset;
        })
        .attr('y', (d) => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const offset = 40; // Distancia desde el nodo origen (aumentada de 25 a 40)
          return d.source.y + (dy / length) * offset;
        });
    }

    // Posiciones iniciales
    updatePositions();

    // Centrar zoom inicial
    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(1);
    svg.call(zoom.transform, initialTransform);

  }, [banks, nostros, grouped, edges, loadPositions, savePositions, saveZonePositions, resetTrigger]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '350px', background: '#0f172a', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundImage: 'url(/World_background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.3,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <svg ref={svgRef} style={{ display: 'block', position: 'relative', zIndex: 1 }} />
    </div>
  );
}

// Memoizar el componente para evitar re-renderizados innecesarios
// Solo se re-renderizará cuando cambien banks o nostros
export default React.memo(BankNetworkGraph, (prevProps, nextProps) => {
  // Comparar banks
  if (prevProps.banks.length !== nextProps.banks.length) return false;
  if (prevProps.banks.some((b, i) => b.id !== nextProps.banks[i]?.id)) return false;

  // Comparar nostros
  if (prevProps.nostros.length !== nextProps.nostros.length) return false;
  if (prevProps.nostros.some((n, i) =>
    n.ownerBankId !== nextProps.nostros[i]?.ownerBankId ||
    n.correspondentBankId !== nextProps.nostros[i]?.correspondentBankId ||
    n.currency !== nextProps.nostros[i]?.currency
  )) return false;

  // Si todo es igual, no re-renderizar
  return true;
});
