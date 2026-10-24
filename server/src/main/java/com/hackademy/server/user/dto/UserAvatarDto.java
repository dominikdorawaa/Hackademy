package com.hackademy.server.user.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record UserAvatarDto(
        @NotNull @Pattern(regexp = UserAvatarDto.OUTFITS) String outfit,
        @NotNull @Pattern(regexp = UserAvatarDto.HAIR_STYLES) String hair,
        @NotNull @Pattern(regexp = UserAvatarDto.HAT_STYLES) String hat,
        @NotNull @Pattern(regexp = UserAvatarDto.SKIN_TONES) String skin,
        @NotNull @Pattern(regexp = UserAvatarDto.HAIR_COLORS) String hairColor,
        @NotNull @Pattern(regexp = UserAvatarDto.CLOTH_COLORS) String topColor,
        @NotNull @Pattern(regexp = UserAvatarDto.CLOTH_COLORS) String bottomColor,
        @NotNull @Pattern(regexp = UserAvatarDto.CLOTH_COLORS) String shoesColor,
        @NotNull @Pattern(regexp = UserAvatarDto.CLOTH_COLORS) String hatColor,
        @Pattern(regexp = UserAvatarDto.POSES) String pose,
        @Pattern(regexp = UserAvatarDto.FINISHERS) String finisher,
        @Pattern(regexp = UserAvatarDto.VICTORY_DANCES) String victoryDance) {

    public static final String OUTFITS = "baza|bluza|dres";
    public static final String HAIR_STYLES = "brak|krotkie|irokez|kucyk";
    public static final String HAT_STYLES = "brak|czapka|daszek";
    public static final String CUSTOM_COLOR = "#[0-9a-f]{6}";
    public static final String SKIN_TONES = "porcelanowa|jasna|oliwkowa|brazowa|ciemna|heban|" + CUSTOM_COLOR;
    public static final String HAIR_COLORS = "czarne|brazowe|rude|blond|siwe|niebieskie|" + CUSTOM_COLOR;
    public static final String CLOTH_COLORS = "granatowy|grafitowy|bordowy|turkusowy|piaskowy|oliwkowy|czerwony|bialy|" + CUSTOM_COLOR;
    public static final String POSES = "przod|postawa|profil";
    public static final String DEFAULT_POSE = "przod";
    public static final String FINISHERS = "beam|combo";
    public static final String DEFAULT_FINISHER = "beam";
    public static final String VICTORY_DANCES = "groove|sixseven|scuba";
    public static final String DEFAULT_VICTORY_DANCE = "groove";
}
