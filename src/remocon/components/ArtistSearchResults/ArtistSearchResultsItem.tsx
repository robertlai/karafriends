import React from "react";
import { Link } from "react-router-dom";
import { isRomaji, toRomaji } from "wanakana";

import { ListItem } from "../List";
import styles from "./ArtistSearchResults.module.scss";
import { ArtistSearchResults_artistsByName } from "./__generated__/ArtistSearchResults_artistsByName.graphql";

type Props = ArtistSearchResults_artistsByName["artistsByName"]["edges"][0]["node"];

const ArtistSearchResultsItem = ({ id, name, nameYomi, songCount }: Props) => (
  <Link to={`/artist/${id}`}>
    <ListItem>
      <span className={styles.title}>{name}</span>
      {isRomaji(name) ? null : (
        <span className={styles.romaji}> {toRomaji(nameYomi)}</span>
      )}
      <span className={styles.songCount}>
        {songCount} {songCount === 1 ? "song" : "songs"}
      </span>
    </ListItem>
  </Link>
);

export default ArtistSearchResultsItem;
