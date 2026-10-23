package com.hackademy.server.ratelimit;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ClientAddressTest {

    @ParameterizedTest
    @CsvSource({
            "203.0.113.7, 203.0.113.7",
            "' 203.0.113.7 ', 203.0.113.7",
            "2001:db8:1:2:3:4:5:6, 20010db800010002::/64",
            "2001:db8:1:2:ffff:ffff:ffff:ffff, 20010db800010002::/64",
            "2001:DB8:1:2::1, 20010db800010002::/64",
            "::ffff:203.0.113.7, 203.0.113.7",
            "::1, 0000000000000000::/64",
            "not-an-address, not-an-address",
            "1:2:3:4:5:6:7:8:9, 1:2:3:4:5:6:7:8:9"
    })
    void groupsAddressesTheWayOneClientControlsThem(String remote, String expected) {
        assertEquals(expected, ClientAddress.key(remote));
    }

    @ParameterizedTest
    @NullAndEmptySource
    void usesOneKeyForAMissingAddress(String remote) {
        assertEquals("unknown", ClientAddress.key(remote));
    }
}
