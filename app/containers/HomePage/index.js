/*
 * HomePage
 *
 * This is the first thing users see of our App, at the '/' route
 *
 */

import React, { useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import styled from 'styled-components';
import L from 'leaflet';
import { Home } from 'lucide-react';

import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';
import { Card, CardHeader, CardBody, CardFooter, Heading, Text, Stack, StackDivider, Box, Checkbox, Select, OrderedList, ListItem } from '@chakra-ui/react'

// Styles
import styles from './HomePage.css';

// Data
import Gemeinden from './data/gemeinden_simplify200.geojson';
import Landkreise from './data/landkreise_simplify20.geojson';
import MitgliederzahlenGemeinden from './data/mitgliederzahlen_gemeinde.json';

/* Function that adds RS property for easier identification */
const convertZipCodes = () => {
  const data = {};

  Object.entries(MitgliederzahlenGemeinden)
    .forEach(({ 0: zipCode, 1: properties }) => {
      let gemeindeRS = Gemeinden.features.find(x => Number(x.properties.destatis.zip) === Number(zipCode))?.properties.RS;

      if (!gemeindeRS) {
        const gemeinde = Gemeinden.features.find(x => x.properties.GEN === properties.note.slice(6));

        if (gemeinde) {
          gemeindeRS = gemeinde.properties.RS;
        } else {
          console.log("No RS found for " + properties.note + ".");
        }
      }

      data[zipCode] = {
        ...properties,
        RS: gemeindeRS ? Number(gemeindeRS) : null,
      };
    });

  console.log(data);
};

// Helper functions
const lerp = (x, y, a) => x * (1 - a) + y * a;
const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const invlerp = (x, y, a) => clamp((a - x) / (y - x));
const range = (x1, y1, x2, y2, a) => lerp(x2, y2, invlerp(x1, y1, a));

const onEachFeature = ({ properties }, layer, data, layerData) => {
  const memberNum = Object.entries(data).filter(({ 1: x }) => String(x.RS).startsWith(properties.RS)).map(x => x[1].Voltis).reduce((a, b) => a + b, 0);

  layer.bindPopup(renderToStaticMarkup(
    <>
        <h3>{properties.BEZ} {properties.GEN}</h3>
        <p>Einwohnerzahl: {new Intl.NumberFormat('de-DE').format(properties.destatis.population)}</p>
        <p>Bevölkerungsdichte: {new Intl.NumberFormat('de-DE').format(properties.destatis.population_density)}</p>
        {memberNum > 0 ? <p>Volt-Mitglieder: {new Intl.NumberFormat('de-DE').format(memberNum)}</p> : null}
    </>
    )
  );

  layer.on('click', () => {
    console.log(properties);
  });
};

const featureToStyle = ({ properties }, layer, data, { features }) => {
  const minPopulation = Math.min(...features.map(({ properties }) => properties.destatis.population));
  const maxPopulation = Math.max(...features.map(({ properties }) => properties.destatis.population));

  const minVoltis = Math.min(...Object.entries(data).map(({ 1: { Voltis } }) => Voltis));
  const maxVoltis = Math.max(...Object.entries(data).map(({ 1: { Voltis } }) => Voltis));

  const memberNum = Object.entries(data).filter(({ 1: x }) => String(x.RS).startsWith(properties.RS)).map(x => x[1].Voltis).reduce((a, b) => a + b, 0);

  return {
    color: memberNum > 0 
              ? `rgba(80, 35, 121, 0.9)`
              : 'rgba(0, 0, 0, 0.9)',
    weight: 1,
    fillOpacity: memberNum > 0 
                  ? range(minVoltis, maxVoltis, 0.5, 1, memberNum) 
                  : range(minPopulation, maxPopulation, 0.1, 1, properties.destatis.population),
  };
};

// Datasets
const LEVELS = {
  'Gemeinden': Gemeinden,
  'Landkreise': Landkreise,
};

export default function HomePage() {
  const [isLoading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('Gemeinden');

  return (
    <>
      <Card 
        pos='absolute'
        top='5'
        right='5'
        zIndex='10'
        maxW='sm'
        className={styles.filters}
      >
        <CardHeader>
          <Heading size="md">Informationen</Heading>
        </CardHeader>

        <CardBody>
          <Stack divider={<StackDivider />} spacing="4">
            <Box>
              <Heading size="sm">Bevölkerungsreichste Städte (ohne Volt-Mitgliedschaften)</Heading>
              <OrderedList>
                {Gemeinden.features
                  .filter(({ properties }) => !(MitgliederzahlenGemeinden[Number(properties.destatis.zip)] && MitgliederzahlenGemeinden[Number(properties.destatis.zip)].Voltis > 0))
                  .sort(({ properties: a }, { properties: b }) => b.destatis.population - a.destatis.population)
                  .slice(0, 10)
                  .map(({ properties: Gemeinde }, index) => (
                    <ListItem>
                      <Text>{Gemeinde.GEN}</Text>
                    </ListItem>
                  ))}
              </OrderedList>
            </Box>
            <Box>
              <Heading size="xs">
                Wahlergebnisse
              </Heading>
              <Select 
                placeholder='Select...'
                value={selectedLevel}
                onChange={e => setSelectedLevel(e.target.value)}
              >
                <option value='Gemeinden'>Gemeinden</option>
                <option value='Landkreise'>Landkreise</option>
              </Select>
            </Box>
            <Box>
              <Heading size="xs">
                Gesamtmitgliederzahl: {Object.entries(MitgliederzahlenGemeinden).map(x => x[1].Voltis).reduce((a, b) => a + b, 0)}
              </Heading>
            </Box>
          </Stack>
        </CardBody>
      </Card>
      <StyledMapContainer 
        center={[52.3906, 13.0645]} 
        zoom={9} 
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          key={`dataset:${selectedLevel}`}
          data={LEVELS[selectedLevel]}
          style={(feature, layer) => featureToStyle(feature, layer, MitgliederzahlenGemeinden, LEVELS[selectedLevel])}
          onEachFeature={(feature, layer) => onEachFeature(feature, layer, MitgliederzahlenGemeinden)}
        />
      </StyledMapContainer>
    </>
  );
}

const StyledMapContainer = styled(MapContainer)`
  position: absolute;
  z-index: 0;
  top: 0;
  bottom: 0;
  width: 100%;
`;