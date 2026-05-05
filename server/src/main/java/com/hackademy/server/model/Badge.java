package com.hackademy.server.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "badges")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Badge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    private String icon;

    @Column(name = "condition_type")
    private String conditionType;

    @Column(name = "condition_value")
    private int conditionValue;

    public Badge(String name, String description, String icon, String conditionType, int conditionValue) {
        this.name = name;
        this.description = description;
        this.icon = icon;
        this.conditionType = conditionType;
        this.conditionValue = conditionValue;
    }
}
