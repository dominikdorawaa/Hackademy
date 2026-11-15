package com.hackademy.server.shop;

import com.hackademy.server.shop.dto.WalletAdjustRequest;
import com.hackademy.server.shop.dto.WalletAdminDto;
import com.hackademy.server.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users/{userId}/wallet")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ShopAdminController {

    private final ShopService shop;

    @GetMapping
    public WalletAdminDto wallet(@PathVariable long userId) {
        return shop.adminWallet(userId);
    }

    @PostMapping
    public WalletAdminDto adjust(@PathVariable long userId, @Valid @RequestBody WalletAdjustRequest request) {
        User admin = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return shop.adjust(userId, request.amount(), request.reason(), admin.getId());
    }
}
