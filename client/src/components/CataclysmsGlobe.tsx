'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CATACLYSMS_DATA, CataclysmData } from '@/data/cataclysms';
import { createStarField, createAtmosphere, setupLighting, enhanceRenderer } from './Globe3DEnhancements';

interface CataclysmsGlobeProps {
  onMarkerClick?: (cataclysm: CataclysmData) => void;
}

export default function CataclysmsGlobe({ onMarkerClick }: CataclysmsGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    let scene = new THREE.Scene();
    let camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      2000
    );
    camera.position.set(0.5, 0.5, 1).setLength(14);

    let renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    enhanceRenderer(renderer);
    container.appendChild(renderer.domElement);

    let labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(container.clientWidth, container.clientHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    let controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 6;
    controls.maxDistance = 15;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    
    // Остановить автовращение при взаимодействии, возобновить через 3 сек
    let autoRotateTimeout: NodeJS.Timeout;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      clearTimeout(autoRotateTimeout);
    });
    
    controls.addEventListener('end', () => {
      clearTimeout(autoRotateTimeout);
      autoRotateTimeout = setTimeout(() => {
        controls.autoRotate = true;
      }, 3000);
    });

    let globalUniforms = {
      time: { value: 0 }
    };

    // Добавляем реалистичное освещение
    setupLighting(scene);

    // Загружаем текстуру карты Земли
    let loader = new THREE.TextureLoader();
    let earthTexture: THREE.Texture | null = null;
    
    loader.load(
      'https://raw.githubusercontent.com/turban/webgl-earth/master/images/2_no_clouds_4k.jpg',
      (texture) => {
        earthTexture = texture;
        console.log('Earth texture loaded');
        // Пересоздаем цвета с учетом текстуры
        updateColors();
      },
      undefined,
      (error) => {
        console.error('Failed to load earth texture:', error);
      }
    );

    let counter = 200000;
    let rad = 5;
    let r = 0;
    let dlong = Math.PI * (3 - Math.sqrt(5));
    let dz = 2 / counter;
    let long = 0;
    let z = 1 - dz / 2;

    let pts: THREE.Vector3[] = [];
    let clr: number[] = [];
    let c = new THREE.Color();
    let uvs: number[] = [];
    let sph = new THREE.Spherical();

    for (let i = 0; i < counter; i++) {
      r = Math.sqrt(1 - z * z);
      let p = new THREE.Vector3(
        Math.cos(long) * r,
        z,
        -Math.sin(long) * r
      ).multiplyScalar(rad);
      pts.push(p);
      z = z - dz;
      long = long + dlong;

      // Изначально тёмно-синие оттенки (океан)
      c.setHSL(0.58, 0.4, Math.random() * 0.15 + 0.15);
      c.toArray(clr, i * 3);

      sph.setFromVector3(p);
      uvs.push((sph.theta + Math.PI) / (Math.PI * 2), 1.0 - sph.phi / Math.PI);
    }
    
    // Функция для обновления цветов на основе текстуры
    function updateColors() {
      if (!earthTexture) return;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const img = earthTexture.image;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < counter; i++) {
        const u = uvs[i * 2];
        const v = uvs[i * 2 + 1];
        
        const x = Math.floor(u * (canvas.width - 1));
        const y = Math.floor(v * (canvas.height - 1));
        const idx = (y * canvas.width + x) * 4;
        
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];
        
        // Если точка тёмная (суша) - коричневый, светлая (вода) - синий
        const isLand = r < 100;
        if (isLand) {
          // Суша: коричневые/зелёные оттенки
          c.setHSL(0.12, 0.4, r / 255 * 0.3 + 0.2);
        } else {
          // Океан: синие оттенки
          c.setHSL(0.58, 0.5, b / 255 * 0.3 + 0.15);
        }
        c.toArray(clr, i * 3);
      }
      
      g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    }

    let g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    let m = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true
    });

    (m as any).onBeforeCompile = (shader: any) => {
      shader.vertexShader = `
        varying float vVisibility;
        varying vec3 vNormal;
        varying vec3 vMvPosition;
        ${shader.vertexShader}
      `.replace(
        `gl_PointSize = size;`,
        `
          gl_PointSize = size;
          vNormal = normalMatrix * normalize(position);
          vMvPosition = -mvPosition.xyz;
          gl_PointSize *= 0.4 + (dot(normalize(vMvPosition), vNormal) * 0.6);
        `
      );

      shader.fragmentShader = `
        varying vec3 vNormal;
        varying vec3 vMvPosition;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
          bool circ = length(gl_PointCoord - 0.5) > 0.5;
          bool vis = dot(vMvPosition, vNormal) < 0.;
          if (circ || vis) discard;
          
          vec3 col = diffuse;
          vec4 diffuseColor = vec4( col, opacity );
        `
      );
    };

    let globe = new THREE.Points(g, m);
    scene.add(globe);

    // Добавляем звёздное небо
    const stars = createStarField();
    scene.add(stars);

    // Добавляем атмосферу с glow эффектом
    const atmosphere = createAtmosphere(rad, globalUniforms);
    scene.add(atmosphere);

    // Markers - используем реальные катаклизмы
    let markerCount = CATACLYSMS_DATA.length; // 17 катаклизмов
    let gMarker = new THREE.PlaneGeometry();
    let mMarker = new THREE.MeshBasicMaterial({
      color: 0xff2244
    });

    (mMarker as any).onBeforeCompile = (shader: any) => {
      shader.uniforms.time = globalUniforms.time;
      shader.vertexShader = `
        attribute float phase;
        varying float vPhase;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `#include <begin_vertex>
          vPhase = phase;
        `
      );

      shader.fragmentShader = `
        uniform float time;
        varying float vPhase;
        ${shader.fragmentShader}
      `.replace(
        `vec4 diffuseColor = vec4( diffuse, opacity );`,
        `
          vec2 lUv = (vUv - 0.5) * 2.;
          float val = 0.;
          float lenUv = length(lUv);
          val = max(val, 1. - step(0.25, lenUv));
          val = max(val, step(0.4, lenUv) - step(0.5, lenUv));
          
          float tShift = fract(time * 0.5 + vPhase);
          val = max(val, step(0.4 + (tShift * 0.6), lenUv) - step(0.5 + (tShift * 0.5), lenUv));
          
          if (val < 0.5) discard;
          
          vec4 diffuseColor = vec4( diffuse, opacity );
        `
      );
    };
    (mMarker as any).defines = { USE_UV: ' ' };

    let markers = new THREE.InstancedMesh(gMarker, mMarker, markerCount);
    let dummy = new THREE.Object3D();
    let phase: number[] = [];
    let markerInfo: Array<{ id: number; data: CataclysmData; crd: THREE.Vector3; uv: THREE.Vector2 }> = [];

    function setMarker(id: number, cataclysm: CataclysmData) {
      const lat = cataclysm.location[0];
      const lon = cataclysm.location[1];
      
      let phi = (90 - lat) * (Math.PI / 180);
      let theta = (lon + 180) * (Math.PI / 180);

      let pos = new THREE.Vector3().setFromSphericalCoords(rad, phi, theta);
      markerInfo.push({ id, data: cataclysm, crd: pos, uv: new THREE.Vector2(lon, lat) });

      dummy.position.copy(pos);
      dummy.lookAt(dummy.position.clone().setLength(rad + 1));
      dummy.updateMatrix();
      markers.setMatrixAt(id, dummy.matrix);

      phase.push(Math.random());
    }

    // Размещаем маркеры на реальных координатах катаклизмов
    CATACLYSMS_DATA.forEach((cataclysm, i) => {
      setMarker(i, cataclysm);
    });

    gMarker.setAttribute(
      'phase',
      new THREE.InstancedBufferAttribute(new Float32Array(phase), 1)
    );

    scene.add(markers);

    // Popup window
    let popupDiv = document.createElement('div');
    popupDiv.className = 'cataclysm-popup';
    popupDiv.style.display = 'none';
    popupDiv.style.visibility = 'hidden';
    popupDiv.style.opacity = '0';
    popupDiv.style.pointerEvents = 'all';
    popupDiv.style.maxWidth = '400px';
    popupDiv.style.width = '400px';
    
    let popup = new CSS2DObject(popupDiv);
    popup.position.set(0, -1000, 0); // Прячем далеко за пределы видимости
    scene.add(popup);
    
    function updatePopup(cataclysm: CataclysmData, position: THREE.Vector3) {
      popupDiv.innerHTML = `
        <div style="
          position: relative;
          border-radius: 16px;
          border: 1px solid rgba(34, 255, 68, 0.2);
          background: rgba(9, 9, 11, 0.95);
          backdrop-filter: blur(20px);
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(34, 255, 68, 0.1);
        ">
          <!-- Glassmorphism overlay -->
          <div style="
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(34, 255, 68, 0.05) 0%, transparent 50%, rgba(34, 255, 68, 0.03) 100%);
            pointer-events: none;
          "></div>

          <!-- Close button -->
          <button onclick="this.closest('.cataclysm-popup').style.display='none'; this.closest('.cataclysm-popup').style.visibility='hidden'; this.closest('.cataclysm-popup').style.opacity='0';" style="
            position: absolute;
            top: 12px;
            right: 12px;
            z-index: 10;
            padding: 8px;
            border-radius: 50%;
            background: rgba(9, 9, 11, 0.8);
            border: 1px solid rgba(34, 255, 68, 0.2);
            color: #22ff44;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(9, 9, 11, 0.95)'; this.style.borderColor='rgba(34, 255, 68, 0.4)';" onmouseout="this.style.background='rgba(9, 9, 11, 0.8)'; this.style.borderColor='rgba(34, 255, 68, 0.2)';">
            ✕
          </button>

          <!-- Image section -->
          <div style="
            position: relative;
            height: 180px;
            overflow: hidden;
          ">
            <img src="${cataclysm.image}" alt="${cataclysm.title}" style="
              width: 100%;
              height: 100%;
              object-fit: cover;
            " onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22180%22%3E%3Crect fill=%22%23111%22 width=%22400%22 height=%22180%22/%3E%3Ctext fill=%22%2322ff44%22 font-family=%22monospace%22 font-size=%2214%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3E${cataclysm.title}%3C/text%3E%3C/svg%3E'"/>
            <div style="
              position: absolute;
              inset: 0;
              background: linear-gradient(to top, rgba(9, 9, 11, 1) 0%, rgba(9, 9, 11, 0.5) 50%, transparent 100%);
            "></div>
            
            <!-- Severity badge -->
            <div style="
              position: absolute;
              top: 12px;
              left: 12px;
              padding: 4px 10px;
              border-radius: 6px;
              background: rgba(239, 68, 68, 0.2);
              border: 1px solid rgba(239, 68, 68, 0.3);
              backdrop-filter: blur(8px);
              color: rgba(248, 113, 113, 1);
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Критический
            </div>
          </div>

          <!-- Content section -->
          <div style="padding: 20px;">
            <!-- Title -->
            <h3 style="
              font-size: 22px;
              font-weight: 700;
              color: #22ff44;
              margin: 0 0 8px 0;
              letter-spacing: -0.5px;
            ">${cataclysm.title}</h3>
            
            <!-- Location -->
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 16px;
            ">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22ff44" stroke-width="2" opacity="0.7">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span style="
                font-size: 12px;
                color: rgba(34, 255, 68, 0.7);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-family: monospace;
              ">${cataclysm.city}</span>
            </div>

            <!-- Description -->
            <div style="
              padding: 12px;
              border-radius: 8px;
              background: rgba(9, 9, 11, 0.5);
              border: 1px solid rgba(34, 255, 68, 0.1);
              margin-bottom: 16px;
            ">
              <p style="
                font-size: 13px;
                color: rgba(228, 228, 231, 0.9);
                line-height: 1.6;
                margin: 0;
              ">${cataclysm.description.substring(0, 150)}${cataclysm.description.length > 150 ? '...' : ''}</p>
            </div>

            <!-- Statistics -->
            <div style="
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-bottom: 16px;
            ">
              <!-- Casualties -->
              <div style="
                padding: 12px;
                border-radius: 8px;
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(127, 29, 29, 0.05) 100%);
                border: 1px solid rgba(239, 68, 68, 0.2);
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  margin-bottom: 6px;
                ">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(248, 113, 113, 1)" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span style="
                    font-size: 10px;
                    color: rgba(248, 113, 113, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-family: monospace;
                  ">Погибших</span>
                </div>
                <div style="
                  font-size: 20px;
                  font-weight: 700;
                  color: rgba(248, 113, 113, 1);
                ">${cataclysm.population}</div>
              </div>

              <!-- Coordinates -->
              <div style="
                padding: 12px;
                border-radius: 8px;
                background: linear-gradient(135deg, rgba(34, 255, 68, 0.1) 0%, rgba(21, 128, 61, 0.05) 100%);
                border: 1px solid rgba(34, 255, 68, 0.2);
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  margin-bottom: 6px;
                ">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22ff44" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <span style="
                    font-size: 10px;
                    color: rgba(34, 255, 68, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    font-family: monospace;
                  ">Координаты</span>
                </div>
                <div style="
                  font-size: 11px;
                  font-family: monospace;
                  color: #22ff44;
                  line-height: 1.4;
                ">
                  ${cataclysm.location[0].toFixed(2)}° N<br/>
                  ${cataclysm.location[1].toFixed(2)}° E
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      popup.position.copy(position);
      popupDiv.style.display = 'block';
      popupDiv.style.visibility = 'visible';
      popupDiv.style.opacity = '1';
    }
    
    function hidePopup() {
      popupDiv.style.display = 'none';
      popupDiv.style.visibility = 'hidden';
      popupDiv.style.opacity = '0';
    }

    // Raycasting
    let raycaster = new THREE.Raycaster();
    let mouse = new THREE.Vector2();
    let selectedId = -1;

    function onClick(event: MouseEvent) {
      if (selectedId !== -1) {
        const mi = markerInfo[selectedId];
        updatePopup(mi.data, mi.crd);
      }
    }

    function onPointerMove(event: PointerEvent) {
      let rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      let intersects = raycaster.intersectObject(markers);

      if (intersects.length > 0) {
        let instanceId = intersects[0].instanceId!;
        let uv = intersects[0].uv!;

        let lUv = new THREE.Vector2(uv.x - 0.5, uv.y - 0.5).multiplyScalar(2);
        if (lUv.length() <= 0.5) {
          selectedId = instanceId;
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }

      selectedId = -1;
      renderer.domElement.style.cursor = 'default';
    }

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    // Resize
    function onResize() {
      let width = container.clientWidth;
      let height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      labelRenderer.setSize(width, height);
    }

    window.addEventListener('resize', onResize);

    // Animation
    let animationId: number;
    let clock = new THREE.Clock();

    function animate() {
      animationId = requestAnimationFrame(animate);

      let t = clock.getElapsedTime();
      globalUniforms.time.value = t;

      // Медленное вращение звёзд для динамики
      stars.rotation.y += 0.00005;

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(autoRotateTimeout);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
      renderer.dispose();
    };
  }, [onMarkerClick]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full"
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
