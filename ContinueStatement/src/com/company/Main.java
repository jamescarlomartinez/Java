package com.company;

public class Main {

    public static void main(String[] args) {
	int [] num = {1,2,3,4,5,6,7,8,9};
        for (int x : num){
            if( x == 3)

            {
                continue;
            }
            System.out.print(x);
        }

    }
}
